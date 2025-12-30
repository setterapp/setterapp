import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

// Security: Require all secrets to be configured via environment variables
const VERIFY_TOKEN = Deno.env.get('INSTAGRAM_WEBHOOK_VERIFY_TOKEN');
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY') ?? '';

if (!VERIFY_TOKEN) {
    console.error('❌ INSTAGRAM_WEBHOOK_VERIFY_TOKEN must be configured');
}

// Crear cliente de Supabase con service role key para operaciones administrativas
const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log(`Instagram webhook function initialized`);

function extractPlatformMessageId(event: any): string | null {
    const msg = event?.message ?? event?.value?.message ?? event?.value?.messages?.[0] ?? null;
    const id = msg?.mid ?? msg?.id ?? event?.message_id ?? event?.mid ?? null;
    return typeof id === 'string' && id.trim() !== '' ? id : null;
}

// Helper: Verifica si un error de API es por token inválido/expirado (code 190)
function isTokenExpiredError(errorData: any): boolean {
    return errorData?.error?.code === 190 || errorData?.error?.code === '190';
}

// Helper: Normaliza el timestamp del webhook a ms y segundos
function normalizeWebhookTimestamp(rawTimestamp: any): { timestampInMs: number; timestampInSeconds: number } {
    const now = Date.now();
    const fallback = {
        timestampInMs: now,
        timestampInSeconds: Math.floor(now / 1000)
    };

    // Parsear timestamp (puede venir como number o string)
    const parsedTimestamp = (typeof rawTimestamp === 'number' && Number.isFinite(rawTimestamp))
        ? rawTimestamp
        : (typeof rawTimestamp === 'string' && rawTimestamp.trim() !== '' && Number.isFinite(Number(rawTimestamp))
            ? Number(rawTimestamp)
            : null);

    if (parsedTimestamp === null) {
        return fallback;
    }

    // Determinar si está en milisegundos (> 1e12) o segundos (< 1e10)
    let timestampInMs: number;
    let timestampInSeconds: number;

    if (parsedTimestamp > 1e12) {
        timestampInMs = parsedTimestamp;
        timestampInSeconds = Math.floor(parsedTimestamp / 1000);
    } else {
        timestampInSeconds = parsedTimestamp;
        timestampInMs = parsedTimestamp * 1000;
    }

    // Validar que el timestamp sea razonable (año entre 2000 y 2100)
    const date = new Date(timestampInMs);
    const year = date.getFullYear();
    const isValidDate = !isNaN(date.getTime()) && year >= 2000 && year <= 2100;

    if (!isValidDate || !Number.isFinite(timestampInMs) || timestampInMs <= 0) {
        console.warn('⚠️ Invalid timestamp, using current time as fallback:', {
            rawTimestamp,
            parsedTimestamp,
            year,
            isValidDate
        });
        return fallback;
    }

    return { timestampInMs, timestampInSeconds };
}

Deno.serve(async (req: Request) => {
    // Manejar CORS
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
    }

    try {
        const url = new URL(req.url);

        // Verificación inicial del webhook (GET request)
        if (req.method === 'GET') {
            const mode = url.searchParams.get('hub.mode');
            const token = url.searchParams.get('hub.verify_token');
            const challenge = url.searchParams.get('hub.challenge');

            console.log('Webhook verification request');
            // Don't log tokens in production

            if (mode === 'subscribe' && token === VERIFY_TOKEN) {
                console.log('✅ Webhook verified successfully');
                return new Response(challenge, {
                    status: 200,
                    headers: { 'Content-Type': 'text/plain' },
                });
            } else {
                console.error('❌ Webhook verification failed');
                return new Response('Verification failed', { status: 403 });
            }
        }

        // Recibir eventos del webhook (POST request)
        if (req.method === 'POST') {
            const body = await req.json();
            // Log basic info without exposing full payload
            console.log('📨 Instagram webhook event received');
            console.log('📨 Event object type:', body.object);
            console.log('📨 Event entries:', body.entry?.length || 0);

            // Instagram puede enviar eventos con object: 'instagram' o 'page'
            if (body.object === 'instagram' || body.object === 'page') {
                // Dedupe por-request: Instagram/Meta puede mandar el mismo mensaje en varios formatos
                // (entry.messaging + entry.changes[field=messages] + entry.messages), o reenviar por retries.
                const processedMessageIds = new Set<string>();

                for (const entry of body.entry || []) {
                    const pageId = entry.id;
                    // Processing entry...

                    // Procesar eventos de mensajería (formato estándar)
                    if (entry.messaging) {
                        console.log('📨 Found messaging events:', entry.messaging.length);
                        for (const event of entry.messaging) {
                            const mid = extractPlatformMessageId(event);
                            if (mid) {
                                if (processedMessageIds.has(mid)) {
                                    console.log('🔁 Duplicate message (messaging) ignored:', mid);
                                    continue;
                                }
                                processedMessageIds.add(mid);
                            }
                            await processInstagramEvent(event, pageId);
                        }
                    }

                    // Procesar eventos en formato changes (alternativo)
                    if (entry.changes) {
                        console.log('📨 Found changes events:', entry.changes.length);
                        for (const change of entry.changes) {
                            // Si el change es de tipo messaging, procesarlo
                            if (change.field === 'messages' && change.value) {
                                console.log('📨 Processing messaging change');
                                const mid = extractPlatformMessageId(change.value);
                                if (mid) {
                                    if (processedMessageIds.has(mid)) {
                                        console.log('🔁 Duplicate message (changes) ignored:', mid);
                                        continue;
                                    }
                                    processedMessageIds.add(mid);
                                }
                                await processInstagramEvent(change.value, pageId);
                            } else {
                                await processInstagramChange(change, pageId);
                            }
                        }
                    }

                    // También verificar si hay mensajes directamente en el entry
                    if (entry.messages) {
                        console.log('📨 Found messages directly in entry:', entry.messages.length);
                        for (const message of entry.messages) {
                            const mid = extractPlatformMessageId({ message });
                            if (mid) {
                                if (processedMessageIds.has(mid)) {
                                    console.log('🔁 Duplicate message (entry.messages) ignored:', mid);
                                    continue;
                                }
                                processedMessageIds.add(mid);
                            }
                            // Best-effort mapping: algunos payloads no traen sender/recipient en esta forma
                            await processInstagramEvent({ message }, pageId);
                        }
                    }
                }
            } else {
                console.warn('⚠️ Unknown event object type:', body.object);
                // Security: Never log full payload in production
            }

            // Responder 200 OK a Instagram para confirmar recepción
            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response('Method not allowed', { status: 405 });
    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
});

/**
 * Obtiene el perfil de un usuario de Instagram usando la Graph API
 * OPTIMIZACIÓN: Primero verifica cache en tabla contacts antes de hacer llamada API
 */
async function getInstagramUserProfile(userId: string, senderId: string): Promise<{ name?: string; username?: string; profile_picture?: string } | null> {
    try {
        // 🚀 OPTIMIZACIÓN: Primero buscar en cache (tabla contacts)
        const { data: cachedContact } = await supabase
            .from('contacts')
            .select('username, display_name, profile_picture, updated_at')
            .eq('user_id', userId)
            .eq('platform', 'instagram')
            .eq('external_id', senderId)
            .single();

        // Si encontramos cache reciente (< 7 días), usarlo
        if (cachedContact && cachedContact.username) {
            const cacheAge = Date.now() - new Date(cachedContact.updated_at).getTime();
            const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

            if (cacheAge < sevenDaysInMs) {
                console.log('✅ Username encontrado en cache:', cachedContact.username);
                return {
                    username: cachedContact.username,
                    name: cachedContact.display_name,
                    profile_picture: cachedContact.profile_picture,
                };
            }
        }

        // 📡 Cache miss o expirado -> hacer llamada API
        console.log('📡 Cache miss, obteniendo perfil desde API...');

        // Obtener integración de Instagram para acceder a flags y fallback legacy
        const { data: instagramIntegration, error: instagramError } = await supabase
            .from('integrations')
            .select('config')
            .eq('type', 'instagram')
            .eq('user_id', userId)
            .eq('status', 'connected')
            .maybeSingle();

        const debugEnabled = Boolean(instagramIntegration?.config?.debug_webhooks);

        // Usar access_token de integración IG
        if (instagramError || !instagramIntegration) {
            // Sin logs por defecto (seguridad)
            return null;
        }

        const accessToken = instagramIntegration.config?.access_token;
        if (!accessToken) {
            if (debugEnabled) console.warn('⚠️ No hay access token disponible para obtener perfil');
            return null;
        }

        // Intentar obtener el perfil del usuario usando la Graph API
        // Nota: El senderId es un IGSID (Instagram Scoped ID) que requiere endpoints específicos
        try {
            // Obtener el instagram_business_account_id de la integración
            const { data: integrationWithAccount } = await supabase
                .from('integrations')
                .select('config')
                .eq('type', 'instagram')
                .eq('user_id', userId)
                .eq('status', 'connected')
                .maybeSingle();

            const instagramBusinessAccountId = integrationWithAccount?.config?.instagram_user_id ||
                integrationWithAccount?.config?.instagram_business_account_id;

            if (!instagramBusinessAccountId) {
                console.warn('⚠️ No se encontró instagram_business_account_id en la integración');
                return null;
            }

            // Método 1: Intentar obtener el perfil directamente usando el senderId
            // Esto puede funcionar si el senderId es un ID válido de Instagram
            let response = await fetch(
                `https://graph.instagram.com/v21.0/${senderId}?fields=id,username,name,profile_picture_url&access_token=${accessToken}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (response.ok) {
                const data = await response.json();
                if (data.error) {
                    if (debugEnabled) console.log('⚠️ Error en respuesta directa:', data.error);
                    if (isTokenExpiredError(data)) {
                        if (debugEnabled) console.warn('⚠️ Token inválido o no autorizado. No se puede obtener perfil.');
                        return null;
                    }
                } else {
                    if (debugEnabled) console.log('✅ Perfil obtenido directamente:', data);
                    return {
                        name: data.name || null,
                        username: data.username || null,
                        profile_picture: data.profile_picture_url || null,
                    };
                }
            } else {
                const errorText = await response.text();
                if (debugEnabled) console.log('⚠️ Primer intento falló:', errorText);
                // Verificar si es error de token expirado
                try {
                    const errorData = JSON.parse(errorText);
                    if (isTokenExpiredError(errorData)) {
                        if (debugEnabled) console.warn('⚠️ Token inválido o no autorizado. No se puede obtener perfil.');
                        return null;
                    }
                } catch (e) {
                    // No es JSON, continuar con otros métodos
                }
            }

            // Método 2: Intentar con el endpoint de Facebook Graph API
            response = await fetch(
                `https://graph.facebook.com/v21.0/${senderId}?fields=id,username,name,profile_pic&access_token=${accessToken}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (response.ok) {
                const data = await response.json();
                if (data.error) {
                    if (debugEnabled) console.log('⚠️ Error en respuesta de Facebook:', data.error);
                    // code 190 => token inválido/expirado/revocado/no parseable/tipo incorrecto
                    if (isTokenExpiredError(data)) {
                        if (debugEnabled) console.warn('⚠️ Token inválido o no autorizado. No se puede obtener perfil.');
                        return null;
                    }
                } else {
                    if (debugEnabled) console.log('✅ Perfil obtenido desde Facebook:', data);
                    return {
                        name: data.name || null,
                        username: data.username || null,
                        profile_picture: data.profile_pic || null,
                    };
                }
            } else {
                const errorText = await response.text();
                if (debugEnabled) console.log('⚠️ Segundo intento falló:', errorText);
                // Verificar si es error de token expirado
                try {
                    const errorData = JSON.parse(errorText);
                    if (isTokenExpiredError(errorData)) {
                        if (debugEnabled) console.warn('⚠️ Token inválido o no autorizado. No se puede obtener perfil.');
                        return null;
                    }
                } catch (e) {
                    // No es JSON, continuar con otros métodos
                }
            }

            // Método 3: Intentar obtener información a través del endpoint de conversaciones
            // Buscar conversaciones que incluyan este senderId como participante
            const convResponse = await fetch(
                // Nota: endpoints de Messaging/Business van por graph.facebook.com (no graph.instagram.com)
                `https://graph.facebook.com/v21.0/${instagramBusinessAccountId}/conversations?fields=participants&access_token=${accessToken}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (convResponse.ok) {
                const convData = await convResponse.json();
                if (debugEnabled) console.log('📋 Conversaciones obtenidas:', convData);

                // Buscar la conversación que contiene este senderId
                if (convData.data && convData.data.length > 0) {
                    for (const conversation of convData.data) {
                        if (conversation.participants?.data) {
                            const participant = conversation.participants.data.find((p: any) => p.id === senderId);
                            if (participant) {
                                if (debugEnabled) console.log('✅ Participante encontrado:', participant);
                                // Intentar obtener el perfil completo del participante
                                const participantResponse = await fetch(
                                    `https://graph.facebook.com/v21.0/${participant.id}?fields=id,username,name,profile_pic&access_token=${accessToken}`,
                                    {
                                        method: 'GET',
                                        headers: {
                                            'Content-Type': 'application/json',
                                        },
                                    }
                                );

                                if (participantResponse.ok) {
                                    const participantData = await participantResponse.json();
                                    if (!participantData.error) {
                                        return {
                                            name: participantData.name || participant.name || null,
                                            username: participantData.username || participant.username || null,
                                            profile_picture: participantData.profile_pic || participant.profile_pic || null,
                                        };
                                    }
                                }

                                // Si no podemos obtener más datos, usar los que tenemos del participante
                                return {
                                    name: participant.name || null,
                                    username: participant.username || null,
                                    profile_picture: participant.profile_pic || null,
                                };
                            }
                        }
                    }
                }
            } else {
                const errorText = await convResponse.text();
                if (debugEnabled) console.log('⚠️ Error obteniendo conversaciones:', errorText);
            }

            if (debugEnabled) console.warn('⚠️ No se pudo obtener perfil de Instagram después de todos los intentos');
            return null;
        } catch (error) {
            if (debugEnabled) console.warn('⚠️ Error al obtener perfil de Instagram:', error);
            return null;
        }
    } catch (error) {
        // Sin logs por defecto (seguridad)
        return null;
    }
}

/**
 * Obtiene el user_id asociado a una integración de Instagram
 * Intenta buscar por pageId primero, si no encuentra, usa la primera integración conectada
 */
async function getUserIdFromPageId(pageId: string): Promise<string | null> {
    try {
        // Buscar integraciones conectadas relevantes (instagram + facebook)
        const { data: integrations, error } = await supabase
            .from('integrations')
            .select('user_id, type, config')
            .in('type', ['instagram', 'facebook'])
            .eq('status', 'connected');

        if (error) {
            console.error('❌ Error finding integrations:', error);
            return null;
        }

        if (!integrations || integrations.length === 0) {
            console.error('❌ No connected integrations found');
            return null;
        }

        // Si hay pageId, intentar encontrar una que coincida
        if (pageId) {
            for (const integration of integrations) {
                const config = integration.config || {};
                const candidateIds = new Set<string>();
                // IDs comunes que podemos recibir en webhooks IG (dependiendo de object/formato)
                // - page_id / pageId: Facebook Page ID
                // - instagram_business_account_id / instagram_user_id: IG Business Account ID
                // - instagram_page_id: algunos flows legacy lo guardan así
                const maybeIds = [
                    config.page_id,
                    config.pageId,
                    config.instagram_page_id,
                    config.instagram_user_id,
                    config.instagram_business_account_id,
                    config.instagramBusinessAccountId,
                ];
                for (const v of maybeIds) {
                    if (typeof v === 'string' && v.trim() !== '') candidateIds.add(v);
                    if (typeof v === 'number') candidateIds.add(String(v));
                }

                if (candidateIds.has(pageId)) {
                    console.log('✅ Found integration matching pageId:', pageId);
                    return integration.user_id;
                }
            }
        }

        // Si no coincide, preferir instagram; si no hay, usar la primera conectada
        const instagram = integrations.find((i: any) => i.type === 'instagram');
        if (instagram) {
            console.warn('⚠️ FALLBACK: No exact match for pageId:', pageId, '- using first IG integration for user:', instagram.user_id);
            return instagram.user_id;
        }
        console.warn('⚠️ FALLBACK: No exact match for pageId:', pageId, '- using first integration for user:', integrations[0].user_id);
        return integrations[0].user_id;
    } catch (error) {
        console.error('❌ Error getting user_id from pageId:', error);
        return null;
    }
}

/**
 * Procesa eventos de mensajería de Instagram
 */
async function processInstagramEvent(event: any, pageId: string) {
    try {
        // Processing Instagram messaging event...

        // Procesar mensajes echo (enviados manualmente desde Instagram)
        if (event.message && event.message.is_echo) {
            await processEchoMessage(event, pageId);
            return;
        }

        // Procesar mensajes entrantes (inbound)
        if (event.message) {
            const message = event.message;
            const senderId = event.sender?.id;
            const recipientId = event.recipient?.id;
            const { timestampInMs, timestampInSeconds } = normalizeWebhookTimestamp(event.timestamp);

            const messageId = message.mid || message.id;
            const messageText = message.text || '';

            // Security: Log only metadata, never message content
            console.log('📩 Message received:', {
                messageId,
                timestamp: new Date(timestampInMs).toISOString(),
                pageId
            });

            // Obtener user_id de la integración
            const userId = await getUserIdFromPageId(pageId);
            if (!userId) {
                console.error('❌ Could not find user_id for pageId:', pageId);
                return;
            }

            // Found user_id for pageId

            // Debug opt-in: guardar el payload completo del evento en DB para verlo en la consola del navegador via Realtime
            try {
                const { data: dbgIntegration } = await supabase
                    .from('integrations')
                    .select('config')
                    .eq('type', 'instagram')
                    .eq('user_id', userId)
                    .eq('status', 'connected')
                    .single();

                const debugEnabled = Boolean(dbgIntegration?.config?.debug_webhooks);
                if (debugEnabled) {
                    await supabase
                        .from('webhook_debug_events')
                        .insert({
                            user_id: userId,
                            platform: 'instagram',
                            payload: {
                                pageId,
                                event,
                            }
                        });
                }
            } catch (e) {
                // No romper el webhook por debug
            }

            // Obtener perfil del usuario (requiere App Review aprobado)
            // Para habilitar: cambiar APP_REVIEW_APPROVED a true
            const APP_REVIEW_APPROVED = false; // ⬅️ CAMBIAR A true DESPUÉS DEL APP REVIEW

            let userProfile = null;
            if (APP_REVIEW_APPROVED) {
                userProfile = await getInstagramUserProfile(userId, senderId);
                if (userProfile?.username) {
                    console.log('✅ Username obtenido:', userProfile.username);
                }
            } else {
                console.log('ℹ️ Profile fetching disabled (APP_REVIEW_APPROVED = false)');
            }

            // Usar username si está disponible, sino el senderId
            const displayName = userProfile?.username || userProfile?.name || senderId;
            const contactName = displayName;

            // Crear o actualizar contacto (CRM) - NO sobrescribir lead_status si ya existe
            let contactId: string | null = null;
            try {
                // Primero buscar si el contacto ya existe
                const { data: existingContact } = await supabase
                    .from('contacts')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('platform', 'instagram')
                    .eq('external_id', senderId)
                    .maybeSingle();

                if (existingContact) {
                    // Contacto existe: actualizar SIN tocar lead_status
                    await supabase
                        .from('contacts')
                        .update({
                            display_name: contactName,
                            username: userProfile?.username || null,
                            profile_picture: userProfile?.profile_picture || null,
                            last_message_at: new Date(timestampInMs).toISOString(),
                            metadata: userProfile ? {
                                username: userProfile.username,
                                name: userProfile.name,
                                profile_picture: userProfile.profile_picture,
                            } : {},
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', existingContact.id);
                    contactId = existingContact.id;
                } else {
                    // Contacto nuevo: crear con lead_status: 'cold'
                    const { data: newContact } = await supabase
                        .from('contacts')
                        .insert({
                            user_id: userId,
                            platform: 'instagram',
                            external_id: senderId,
                            display_name: contactName,
                            username: userProfile?.username || null,
                            profile_picture: userProfile?.profile_picture || null,
                            last_message_at: new Date(timestampInMs).toISOString(),
                            lead_status: 'cold',
                            metadata: userProfile ? {
                                username: userProfile.username,
                                name: userProfile.name,
                                profile_picture: userProfile.profile_picture,
                            } : {},
                        })
                        .select('id')
                        .single();
                    contactId = newContact?.id || null;
                }
            } catch {
                // No romper el webhook por CRM
            }

            // Buscar o crear conversación
            let conversationId: string | null = null;

            // Buscar conversación existente
            const { data: existingConv, error: findError } = await supabase
                .from('conversations')
                .select('id')
                .eq('user_id', userId)
                .eq('platform', 'instagram')
                .eq('platform_conversation_id', senderId)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (findError) {
                console.error('❌ Error finding conversation:', findError);
            }

            if (existingConv) {
                conversationId = existingConv.id;
                // Found existing conversation

                // Actualizar last_message_at y unread_count
                // También actualizar el nombre si tenemos nueva información del perfil
                // Primero obtener el unread_count actual
                const { data: currentConv } = await supabase
                    .from('conversations')
                    .select('unread_count, contact')
                    .eq('id', conversationId)
                    .single();

                const updateDate = new Date(timestampInMs);
                const updateDateISO = updateDate.toISOString();

                // Si el contacto actual es solo un ID y tenemos nombre/username, actualizarlo
                const updateData: any = {
                    last_message_at: updateDateISO,
                    unread_count: (currentConv?.unread_count || 0) + 1,
                    updated_at: new Date().toISOString(),
                };
                if (contactId) updateData.contact_id = contactId;

                // Actualizar el nombre si tenemos información del perfil y el contacto actual es solo un ID
                if (userProfile && (currentConv?.contact === senderId || !currentConv?.contact || currentConv?.contact.match(/^\d+$/))) {
                    updateData.contact = displayName;
                    updateData.contact_metadata = {
                        username: userProfile.username,
                        name: userProfile.name,
                        profile_picture: userProfile.profile_picture,
                    };
                    // Updating contact name and metadata
                } else if (userProfile) {
                    // Actualizar metadata aunque el nombre ya esté actualizado
                    updateData.contact_metadata = {
                        username: userProfile.username,
                        name: userProfile.name,
                        profile_picture: userProfile.profile_picture,
                    };
                }

                await supabase
                    .from('conversations')
                    .update(updateData)
                    .eq('id', conversationId);

                console.log('✅ Updated conversation:', conversationId);
            } else {
                // Crear nueva conversación
                // Asegurarse de que la fecha sea válida antes de insertar
                const lastMessageDate = new Date(timestampInMs);
                const lastMessageDateISO = lastMessageDate.toISOString();

                console.log('📅 Creating conversation with date:', {
                    timestampInMs,
                    lastMessageDate: lastMessageDateISO,
                    isValid: !isNaN(lastMessageDate.getTime())
                });

                const { data: newConv, error: createError } = await supabase
                    .from('conversations')
                    .insert({
                        user_id: userId,
                        platform: 'instagram',
                        platform_conversation_id: senderId,
                        platform_page_id: pageId,
                        contact_id: contactId,
                        contact: displayName, // Usar username o name si está disponible
                        last_message_at: lastMessageDateISO,
                        unread_count: 1,
                        lead_status: 'cold', // Estado inicial para nuevos leads
                        contact_metadata: userProfile ? {
                            username: userProfile.username,
                            name: userProfile.name,
                            profile_picture: userProfile.profile_picture,
                        } : {},
                    })
                    .select('id')
                    .single();

                if (createError) {
                    console.error('❌ Error creating conversation:', createError);
                    return;
                }

                conversationId = newConv.id;
                console.log('✅ Created new conversation:', conversationId);
            }

            // Guardar el mensaje
            if (conversationId && messageText) {
                console.log('💾 Saving message to database:', {
                    conversationId,
                    messageId
                });

                // Verificar primero si ya existe para tener mejor visibilidad
                const { data: existingMessage } = await supabase
                    .from('messages')
                    .select('id, created_at')
                    .eq('user_id', userId)
                    .eq('platform_message_id', messageId)
                    .maybeSingle();

                if (existingMessage) {
                    console.log('ℹ️ Message already exists in database (duplicate webhook):', {
                        messageId,
                        existingId: existingMessage.id,
                        createdAt: existingMessage.created_at
                    });
                    // Es un duplicado real, no procesarlo de nuevo
                    return new Response(JSON.stringify({ success: true, skipped: 'duplicate' }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                }

                // No existe, proceder a insertarlo
                const { data: savedMessage, error: messageError } = await supabase
                    .from('messages')
                    .insert({
                        conversation_id: conversationId,
                        user_id: userId,
                        platform_message_id: messageId,
                        content: messageText,
                        direction: 'inbound',
                        message_type: 'text',
                        metadata: {
                            sender_id: senderId,
                            recipient_id: recipientId,
                            timestamp: timestampInSeconds,
                            raw_timestamp: event.timestamp,
                        },
                    })
                    .select('id')
                    .single();

                if (messageError) {
                    console.error('❌ Error saving message:', messageError);
                    console.error('❌ Error details:', JSON.stringify(messageError, null, 2));

                    // Si falla por violación de unique constraint, es race condition (2 webhooks simultáneos)
                    if (messageError.code === '23505') {
                        console.log('ℹ️ Race condition: message became duplicate during insert');
                        return new Response(JSON.stringify({ success: true, skipped: 'race_condition' }), {
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        });
                    }

                    // Otro error, no bloquear el webhook pero logear
                    throw messageError;
                }

                console.log('✅ Message saved successfully with ID:', savedMessage.id);

                // 🤖 Verificar si AI está habilitada para esta conversación
                const { data: convData } = await supabase
                    .from('conversations')
                    .select('ai_enabled')
                    .eq('id', conversationId)
                    .single();

                const isAiEnabled = convData?.ai_enabled !== false; // Default true if null/undefined

                if (isAiEnabled) {
                    // Generar y enviar respuesta automática con IA
                    generateAndSendAutoReply(userId, conversationId, senderId, messageText)
                        .catch(error => {
                            console.error('❌ Error en respuesta automática:', error);
                            // No lanzar el error para no afectar el webhook
                        });
                } else {
                    console.log('ℹ️ AI disabled for this conversation, skipping auto-reply');
                }

                // Clasificación automática de lead status removida - ahora es manual por el usuario
            }

            // Manejar otros tipos de mensajes (imágenes, etc.)
            if (message.attachments) {
                console.log('📎 Message has attachments:', message.attachments);
                // TODO: Guardar información de attachments en metadata
            }
        }

        // Manejar otros tipos de eventos (delivery, read, etc.)
        if (event.delivery) {
            console.log('📬 Message delivery receipt:', event.delivery);
        }

        if (event.read) {
            console.log('👁️ Message read receipt:', event.read);
        }
    } catch (error) {
        console.error('❌ Error processing Instagram event:', error);
    }
}

/**
 * Procesa mensajes echo (enviados manualmente desde Instagram, no desde la app)
 * Esto permite ver en la app los mensajes que envías directamente desde Instagram
 */
async function processEchoMessage(event: any, pageId: string) {
    try {
        const message = event.message;
        const senderId = event.sender?.id; // Tu cuenta de Instagram
        const recipientId = event.recipient?.id; // El contacto al que enviaste
        const { timestampInMs, timestampInSeconds } = normalizeWebhookTimestamp(event.timestamp);

        const messageId = message.mid || message.id;
        const messageText = message.text || '';

        console.log('📤 Echo message (manual send) received:', {
            messageId,
            recipientId,
            timestamp: new Date(timestampInMs).toISOString()
        });

        // Obtener user_id de la integración
        const userId = await getUserIdFromPageId(pageId);
        if (!userId) {
            console.error('❌ Could not find user_id for pageId:', pageId);
            return;
        }

        // Buscar conversación existente con este contacto
        // El recipientId es el contacto porque nosotros enviamos el mensaje
        const { data: existingConv, error: findError } = await supabase
            .from('conversations')
            .select('id')
            .eq('user_id', userId)
            .eq('platform', 'instagram')
            .eq('platform_conversation_id', recipientId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (findError) {
            console.error('❌ Error finding conversation for echo:', findError);
            return;
        }

        let conversationId = existingConv?.id;

        // Si no existe conversación, crear una nueva
        if (!conversationId) {
            console.log('📝 Creating new conversation for echo message');

            // Crear o actualizar contacto - NO sobrescribir lead_status
            let contactId: string | null = null;
            const { data: existingEchoContact } = await supabase
                .from('contacts')
                .select('id')
                .eq('user_id', userId)
                .eq('platform', 'instagram')
                .eq('external_id', recipientId)
                .maybeSingle();

            if (existingEchoContact) {
                // Actualizar solo last_message_at
                await supabase
                    .from('contacts')
                    .update({
                        last_message_at: new Date(timestampInMs).toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', existingEchoContact.id);
                contactId = existingEchoContact.id;
            } else {
                // Crear contacto nuevo
                const { data: newEchoContact } = await supabase
                    .from('contacts')
                    .insert({
                        user_id: userId,
                        platform: 'instagram',
                        external_id: recipientId,
                        display_name: recipientId,
                        last_message_at: new Date(timestampInMs).toISOString(),
                        lead_status: 'cold',
                    })
                    .select('id')
                    .single();
                contactId = newEchoContact?.id || null;
            }

            // Crear conversación
            const { data: newConv, error: createError } = await supabase
                .from('conversations')
                .insert({
                    user_id: userId,
                    platform: 'instagram',
                    platform_conversation_id: recipientId,
                    platform_page_id: pageId,
                    contact_id: contactId,
                    contact: recipientId,
                    last_message_at: new Date(timestampInMs).toISOString(),
                    unread_count: 0, // Echo messages don't increase unread count
                    lead_status: 'cold',
                })
                .select('id')
                .single();

            if (createError) {
                console.error('❌ Error creating conversation for echo:', createError);
                return;
            }

            conversationId = newConv.id;
            console.log('✅ Created new conversation for echo:', conversationId);
        } else {
            // Actualizar last_message_at de la conversación existente
            await supabase
                .from('conversations')
                .update({
                    last_message_at: new Date(timestampInMs).toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', conversationId);
        }

        // Guardar el mensaje como outbound (enviado)
        if (conversationId && messageText) {
            // Verificar si ya existe
            const { data: existingMessage } = await supabase
                .from('messages')
                .select('id')
                .eq('user_id', userId)
                .eq('platform_message_id', messageId)
                .maybeSingle();

            if (existingMessage) {
                console.log('ℹ️ Echo message already exists:', messageId);
                return;
            }

            const { error: messageError } = await supabase
                .from('messages')
                .insert({
                    conversation_id: conversationId,
                    user_id: userId,
                    platform_message_id: messageId,
                    content: messageText,
                    direction: 'outbound',
                    message_type: 'text',
                    metadata: {
                        sender_id: senderId,
                        recipient_id: recipientId,
                        timestamp: timestampInSeconds,
                        source: 'instagram_manual', // Marca que fue enviado desde Instagram directamente
                    },
                });

            if (messageError) {
                console.error('❌ Error saving echo message:', messageError);
                return;
            }

            console.log('✅ Echo message saved successfully');
        }

        // Manejar attachments en echo messages
        if (message.attachments) {
            console.log('📎 Echo message has attachments:', message.attachments.length);
        }

    } catch (error) {
        console.error('❌ Error processing echo message:', error);
    }
}

/**
 * Procesa cambios en Instagram (publicaciones, comentarios, etc.)
 */
async function processInstagramChange(change: any, pageId: string) {
    try {
        // Processing Instagram change
        // Implementa la lógica para procesar cambios si es necesario
    } catch (error) {
        console.error('Error processing Instagram change:', error);
    }
}

/**
 * Obtiene el agent de Instagram asignado al usuario
 */
async function getInstagramAgent(userId: string) {
    try {
        const { data: agent, error } = await supabase
            .from('agents')
            .select('*')
            .eq('user_id', userId)
            .eq('platform', 'instagram')
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('❌ Error getting agent:', error);
            return null;
        }

        return agent;
    } catch (error) {
        console.error('❌ Error getting agent:', error);
        return null;
    }
}

/**
 * Obtiene el historial de conversación para generar contexto
 * Limitado a 25 mensajes para mantener el contexto manejable
 */
async function getConversationHistory(conversationId: string, limit: number = 25) {
    try {
        const { data: messages, error } = await supabase
            .from('messages')
            .select('content, direction, created_at')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('❌ Error getting conversation history:', error);
            return [];
        }

        // Convertir al formato de OpenAI (más recientes al final)
        return (messages || [])
            .reverse()
            .map(msg => ({
                role: msg.direction === 'inbound' ? 'user' : 'assistant',
                content: msg.content
            }));
    } catch (error) {
        console.error('❌ Error getting conversation history:', error);
        return [];
    }
}

/**
 * Obtiene el contexto guardado del contacto (memoria de largo plazo)
 */
async function getContactContext(conversationId: string): Promise<string | null> {
    try {
        // Obtener contact_id de la conversación
        const { data: conversation } = await supabase
            .from('conversations')
            .select('contact_id')
            .eq('id', conversationId)
            .single();

        if (!conversation?.contact_id) {
            return null;
        }

        // Obtener el contexto del contacto
        const { data: contact } = await supabase
            .from('contacts')
            .select('context')
            .eq('id', conversation.contact_id)
            .single();

        return contact?.context || null;
    } catch (error) {
        console.error('❌ Error getting contact context:', error);
        return null;
    }
}

/**
 * Actualiza el contexto del contacto (memoria de largo plazo)
 */
async function updateContactContext(conversationId: string, newContext: string): Promise<boolean> {
    try {
        // Obtener contact_id de la conversación
        const { data: conversation } = await supabase
            .from('conversations')
            .select('contact_id')
            .eq('id', conversationId)
            .single();

        if (!conversation?.contact_id) {
            console.warn('⚠️ No contact_id found for conversation:', conversationId);
            return false;
        }

        // Actualizar el contexto del contacto
        const { error } = await supabase
            .from('contacts')
            .update({
                context: newContext,
                updated_at: new Date().toISOString()
            })
            .eq('id', conversation.contact_id);

        if (error) {
            console.error('❌ Error updating contact context:', error);
            return false;
        }

        console.log('✅ Contact context updated successfully');
        return true;
    } catch (error) {
        console.error('❌ Error updating contact context:', error);
        return false;
    }
}


/**
 * Divide un mensaje largo en partes de máximo maxLength caracteres
 * Intenta dividir en párrafos, oraciones o palabras para no cortar a mitad
 */
function splitMessage(message: string, maxLength: number = 950): string[] {
    if (message.length <= maxLength) {
        return [message];
    }

    const parts: string[] = [];
    let remaining = message;

    while (remaining.length > 0) {
        if (remaining.length <= maxLength) {
            parts.push(remaining);
            break;
        }

        // Buscar el mejor punto de corte (párrafo > oración > palabra)
        let cutIndex = maxLength;

        // Intentar cortar en un párrafo
        const paragraphBreak = remaining.lastIndexOf('\n\n', maxLength);
        if (paragraphBreak > maxLength * 0.5) {
            cutIndex = paragraphBreak + 2;
        } else {
            // Intentar cortar en una oración
            const sentenceBreak = Math.max(
                remaining.lastIndexOf('. ', maxLength),
                remaining.lastIndexOf('? ', maxLength),
                remaining.lastIndexOf('! ', maxLength)
            );
            if (sentenceBreak > maxLength * 0.5) {
                cutIndex = sentenceBreak + 2;
            } else {
                // Intentar cortar en un espacio
                const spaceBreak = remaining.lastIndexOf(' ', maxLength);
                if (spaceBreak > maxLength * 0.5) {
                    cutIndex = spaceBreak + 1;
                }
            }
        }

        parts.push(remaining.substring(0, cutIndex).trim());
        remaining = remaining.substring(cutIndex).trim();
    }

    return parts;
}

/**
 * Envía un mensaje a Instagram (con soporte para mensajes largos)
 */
async function sendInstagramMessage(userId: string, recipientId: string, message: string) {
    try {
        // Obtener integración de Instagram del usuario
        const { data: integration, error } = await supabase
            .from('integrations')
            .select('config')
            .eq('type', 'instagram')
            .eq('user_id', userId)
            .eq('status', 'connected')
            .single();

        if (error || !integration) {
            console.error('❌ No se encontró integración de Instagram:', error);
            return null;
        }

        const accessToken = integration?.config?.access_token;
        const instagramUserId = integration?.config?.instagram_user_id || integration?.config?.instagram_page_id;

        if (!accessToken || !instagramUserId) {
            console.error('❌ Faltan credenciales de Instagram');
            return null;
        }

        // Dividir mensaje si es muy largo (Instagram tiene límite de 1000 caracteres)
        const messageParts = splitMessage(message, 950);

        if (messageParts.length > 1) {
            console.log(`📝 Mensaje dividido en ${messageParts.length} partes`);
        }

        let lastResult = null;

        for (let i = 0; i < messageParts.length; i++) {
            const part = messageParts[i];

            // Pequeña pausa entre mensajes para evitar rate limiting
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Enviar mensaje usando Instagram Messaging API
            const response = await fetch(
                `https://graph.instagram.com/v21.0/${instagramUserId}/messages`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        recipient: { id: recipientId },
                        message: { text: part }
                    })
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error(`❌ Error enviando mensaje parte ${i + 1}/${messageParts.length} a Instagram:`, errorData);

                // Si el token ha expirado (error code 190), marcar la integración como desconectada
                if (errorData.error?.code === 190 || errorData.error?.code === '190') {
                    console.warn('⚠️ Token de Instagram expirado, marcando integración como desconectada');
                    await supabase
                        .from('integrations')
                        .update({ status: 'disconnected' })
                        .eq('type', 'instagram')
                        .eq('user_id', userId);
                }

                return null;
            }

            lastResult = await response.json();
        }

        return lastResult;
    } catch (error) {
        console.error('❌ Error sending Instagram message:', error);
        return null;
    }
}

/**
 * Genera y envía una respuesta automática con IA
 */
async function generateAndSendAutoReply(
    userId: string,
    conversationId: string,
    recipientId: string,
    inboundMessage: string
) {
    try {
        console.log('🤖 Generando respuesta automática con IA...');

        // 1. Obtener el agent de Instagram del usuario
        const agent = await getInstagramAgent(userId);
        if (!agent) {
            console.log('⚠️ No se encontró agent de Instagram, no se enviará respuesta automática');
            return;
        }

        console.log('✅ Agent encontrado:', agent.name);

        // 2. Obtener historial de conversación (últimos 25 mensajes)
        const conversationHistory = await getConversationHistory(conversationId);

        // 3. Obtener contexto del contacto (memoria de largo plazo)
        const contactContext = await getContactContext(conversationId);
        if (contactContext) {
            console.log('📝 Contexto del contacto cargado:', contactContext.substring(0, 100) + '...');
        }

        // 4. Construir system prompt con el contexto
        const systemPrompt = buildSystemPrompt(agent.name, agent.description, agent.config, contactContext);
        console.log('📋 SYSTEM PROMPT (first 500 chars):', systemPrompt.substring(0, 500));

        // 5. Definir tools para el agente
        let tools: any[] = [
            // Tool para actualizar el contexto del contacto (siempre disponible)
            {
                type: 'function',
                function: {
                    name: 'update_context',
                    description: 'Actualiza tu memoria sobre este lead. Usa esta función para guardar información importante que aprendas durante la conversación: nombre real, qué busca, objeciones, horarios preferidos, país/zona horaria, presupuesto, urgencia, cualquier dato relevante. El contexto debe ser un resumen conciso pero completo.',
                    parameters: {
                        type: 'object',
                        properties: {
                            context: {
                                type: 'string',
                                description: 'Resumen actualizado de todo lo que sabes sobre este lead. Formato sugerido: "Nombre: X | Busca: Y | País: Z | Objeciones: W | Notas: ..."'
                            }
                        },
                        required: ['context']
                    }
                }
            }
        ];

        // Agregar tools de calendario si está habilitado
        if (agent.config?.enableMeetingScheduling === true) {
            tools = [...tools,
                {
                    type: 'function',
                    function: {
                        name: 'check_availability',
                    description: 'Consulta eventos ocupados de los próximos 10 días. Devuelve JSON con config (work_hours, fecha actual) y occupied_events (con start_local, end_local). Propone horarios donde NO hay eventos, dentro de work_hours.',
                    parameters: {
                        type: 'object',
                        properties: {
                            days_ahead: {
                                type: 'number',
                                description: 'Número de días en el futuro a verificar (por defecto 10 días)'
                            }
                        }
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'schedule_meeting',
                    description: 'Agenda una reunión en el calendario de Google con link de Meet. IMPORTANTE: Antes de llamar esta función, SIEMPRE debes pedir el email del lead para enviarle la invitación. Solo llama esta función cuando YA TENGAS el email que el lead te proporcionó.',
                    parameters: {
                        type: 'object',
                        properties: {
                            meeting_date: {
                                type: 'string',
                                description: 'Fecha y hora de la reunión en formato ISO 8601 UTC. Ejemplo: "2025-12-26T18:00:00.000Z" para las 15:00 Argentina (UTC-3). IMPORTANTE: Convierte correctamente el horario local a UTC basándote en el timezone de check_availability.'
                            },
                            duration_minutes: {
                                type: 'number',
                                description: 'Duración de la reunión en minutos (por defecto 30)'
                            },
                            lead_name: {
                                type: 'string',
                                description: 'Nombre completo del lead'
                            },
                            lead_email: {
                                type: 'string',
                                description: 'Email del lead que te proporcionó. Este campo es necesario para enviar la invitación de calendario.'
                            }
                        },
                        required: ['meeting_date', 'lead_name', 'lead_email']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'update_contact_email',
                    description: 'Actualiza el email del contacto/lead en el CRM. Úsala cuando el lead te proporcione un email nuevo o corrija el anterior. Ejemplo: si el lead dice "perdón, el email correcto es otro@mail.com" o "me equivoqué, es nombre@empresa.com".',
                    parameters: {
                        type: 'object',
                        properties: {
                            email: {
                                type: 'string',
                                description: 'El nuevo email del lead que quiere guardar'
                            }
                        },
                        required: ['email']
                    }
                }
            }
            ];
        }

        // 5. Construir mensajes iniciales
        let messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: inboundMessage }
        ];

        // 6. Loop de ejecución de tools (máximo 5 iteraciones para evitar loops infinitos)
        let iteration = 0;
        const maxIterations = 5;
        let finalResponse = null;

        while (iteration < maxIterations) {
            iteration++;
            console.log(`🔄 Iteración ${iteration}: Llamando a OpenAI...`);
            console.log(`📋 Messages array tiene ${messages.length} mensajes:`,
                messages.map((m: any) => `${m.role}${m.tool_call_id ? `[${m.tool_call_id.substring(0, 8)}]` : ''}`)
            );

            // Llamar a OpenAI con tools
            const aiMessage = await generateAIResponse(messages, tools);

            if (!aiMessage) {
                console.error('❌ No se pudo generar respuesta con IA');
                return;
            }

            console.log(`🤖 OpenAI respondió:`, {
                has_content: !!aiMessage.content,
                content_preview: aiMessage.content?.substring(0, 100),
                has_tool_calls: !!aiMessage.tool_calls,
                tool_calls_count: aiMessage.tool_calls?.length || 0
            });

            // Si OpenAI responde con texto (sin tool calls), terminamos
            if (!aiMessage.tool_calls || aiMessage.tool_calls.length === 0) {
                finalResponse = aiMessage.content;
                break;
            }

            // OpenAI quiere llamar tools
            console.log(`🔧 OpenAI solicitó ${aiMessage.tool_calls.length} tool calls`);

            // Agregar el mensaje de IA a la conversación
            messages.push(aiMessage);

            // Ejecutar cada tool call
            for (const toolCall of aiMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);

                console.log(`🔧 Ejecutando ${functionName} con args:`, functionArgs);

                let toolResult = null;

                try {
                    if (functionName === 'check_availability') {
                        toolResult = await executeCheckAvailability(userId, functionArgs);
                    } else if (functionName === 'schedule_meeting') {
                        toolResult = await executeScheduleMeeting(
                            userId,
                            conversationId,
                            agent.id,
                            functionArgs
                        );
                    } else if (functionName === 'update_contact_email') {
                        toolResult = await executeUpdateContactEmail(
                            userId,
                            conversationId,
                            functionArgs
                        );
                    } else if (functionName === 'update_context') {
                        // Actualizar el contexto del contacto (memoria de largo plazo)
                        const success = await updateContactContext(conversationId, functionArgs.context);
                        toolResult = success
                            ? { success: true, message: 'Contexto actualizado correctamente' }
                            : { error: 'No se pudo actualizar el contexto' };
                    } else {
                        toolResult = { error: 'Función desconocida' };
                    }
                } catch (error) {
                    console.error(`❌ Error ejecutando ${functionName}:`, error);
                    toolResult = { error: error instanceof Error ? error.message : 'Error desconocido' };
                }

                // Agregar resultado de la tool a la conversación
                const toolResultString = JSON.stringify(toolResult);
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: toolResultString
                });

                console.log(`✅ Resultado de ${functionName}:`, toolResult);
                console.log(`📤 Tool result enviado a AI (stringified, primeros 500 chars):`, toolResultString.substring(0, 500));

                // Log específico para check_availability
                if (functionName === 'check_availability' && toolResult?.occupied_events) {
                    console.log(`📊 EVENTOS OCUPADOS que la IA verá (${toolResult.occupied_events.length}):`,
                        toolResult.occupied_events.map((e: any) => `${e.title} ${e.start_local}-${e.end_local}`));
                }

                // Log específico para schedule_meeting
                if (functionName === 'schedule_meeting') {
                    if (toolResult?.success) {
                        console.log(`✅ REUNIÓN AGENDADA:`, {
                            meeting_id: toolResult.meeting?.id,
                            meeting_date: toolResult.meeting?.meeting_date,
                            meeting_link: toolResult.meeting?.meeting_link,
                            message: toolResult.message
                        });
                    } else {
                        console.log(`❌ FALLÓ AGENDAR:`, {
                            error: toolResult?.error,
                            valid_hours: toolResult?.valid_hours
                        });
                    }
                }
            }

            // Continuar el loop para que OpenAI procese los resultados
        }

        // 7. Send final response to user
        if (finalResponse) {
            // Check if human style is enabled (multiple messages)
            const humanStyleEnabled = agent.config?.enableHumanStyle !== false;

            if (humanStyleEnabled && finalResponse.includes('[MSG]')) {
                // Split response into multiple messages
                const messages = finalResponse
                    .split('[MSG]')
                    .map((msg: string) => msg.trim())
                    .filter((msg: string) => msg.length > 0);

                console.log(`📨 Sending ${messages.length} separate messages (human style)`);

                for (let i = 0; i < messages.length; i++) {
                    const msg = messages[i];

                    // Small pause between messages to simulate human typing
                    if (i > 0) {
                        const prevMsgLength = messages[i - 1].length;
                        const typingDelay = Math.min(Math.max(prevMsgLength * 20, 300), 2000);
                        await new Promise(resolve => setTimeout(resolve, typingDelay));
                    }

                    const sendResult = await sendInstagramMessage(userId, recipientId, msg);
                    if (!sendResult) {
                        console.error(`❌ Error sending message ${i + 1}/${messages.length}`);
                        break;
                    }

                    // Save EACH message separately to DB using Instagram's message_id to prevent duplicates from echo webhook
                    const platformMsgId = sendResult?.message_id;
                    await saveOutboundMessage(conversationId, userId, msg, agent.id, platformMsgId);
                    console.log(`✅ Message ${i + 1}/${messages.length} sent and saved (id: ${platformMsgId})`);
                }
            } else {
                // Normal mode: single message
                const sendResult = await sendInstagramMessage(userId, recipientId, finalResponse);
                if (sendResult) {
                    // Use Instagram's message_id to prevent duplicates from echo webhook
                    const platformMsgId = sendResult?.message_id;
                    await saveOutboundMessage(conversationId, userId, finalResponse, agent.id, platformMsgId);
                    console.log('✅ Final response sent (id: ' + platformMsgId + ')');
                }
            }
        } else {
            console.warn('⚠️ No final response from agent (max iterations reached)');
        }

    } catch (error) {
        console.error('❌ Error en generateAndSendAutoReply:', error);
    }
}

/**
 * Ejecuta la función check_availability llamando a la Edge Function
 */
async function executeCheckAvailability(userId: string, args: any) {
    try {
        const { data, error } = await supabase.functions.invoke('check-availability', {
            body: {
                user_id: userId,
                days_ahead: args.days_ahead || 10
            }
        });

        if (error) {
            return { error: 'No se pudo verificar disponibilidad', details: error };
        }

        return data;
    } catch (error) {
        return { error: 'Error al verificar disponibilidad' };
    }
}

/**
 * Ejecuta la función schedule_meeting llamando a la Edge Function
 */
async function executeScheduleMeeting(
    userId: string,
    conversationId: string,
    agentId: string,
    args: any
) {
    try {
        const { data, error } = await supabase.functions.invoke('schedule-meeting', {
            body: {
                user_id: userId,
                conversation_id: conversationId,
                agent_id: agentId,
                meeting_date: args.meeting_date,
                duration_minutes: args.duration_minutes || 30,
                lead_name: args.lead_name,
                lead_email: args.lead_email
            }
        });

        if (error) {
            return { error: 'No se pudo agendar la reunión', details: error };
        }

        return data;
    } catch (error) {
        return { error: 'Error al agendar la reunión' };
    }
}

/**
 * Ejecuta la función update_contact_email llamando a la Edge Function
 */
async function executeUpdateContactEmail(
    userId: string,
    conversationId: string,
    args: any
) {
    try {
        const { data, error } = await supabase.functions.invoke('update-contact-email', {
            body: {
                user_id: userId,
                conversation_id: conversationId,
                email: args.email
            }
        });

        if (error) {
            return { error: 'No se pudo actualizar el email', details: error };
        }

        return data;
    } catch (error) {
        return { error: 'Error al actualizar el email' };
    }
}

// Helper para guardar mensaje outbound
async function saveOutboundMessage(conversationId: string, userId: string, content: string, agentId: string, platformMessageId?: string) {
    const metadata = {
        generated_by: 'ai',
        agent_id: agentId,
        model: 'gpt-4o-mini'
    };

    // Use the platform message ID from Instagram if available, otherwise generate one
    const messageId = platformMessageId || `ai_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    await supabase.from('messages').upsert({
        conversation_id: conversationId,
        user_id: userId,
        platform_message_id: messageId,
        content: content,
        direction: 'outbound',
        message_type: 'text',
        metadata: metadata
    }, { onConflict: 'user_id,platform_message_id', ignoreDuplicates: true });
}

/**
 * Genera una respuesta usando Gemini 3 Flash con soporte para tools
 */
async function generateAIResponse(messages: any[], tools?: any[]) {
    if (!GOOGLE_AI_API_KEY) {
        console.error('❌ GOOGLE_AI_API_KEY not configured');
        return null;
    }

    try {
        // Convert OpenAI message format to Gemini format
        const systemInstruction = messages.find((m: any) => m.role === 'system')?.content || '';
        const contents = messages
            .filter((m: any) => m.role !== 'system')
            .map((m: any) => {
                if (m.role === 'tool') {
                    return {
                        role: 'function',
                        parts: [{ functionResponse: { name: 'tool_result', response: { content: m.content } } }]
                    };
                }
                return {
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content || '' }]
                };
            });

        // Convert OpenAI tools to Gemini function declarations
        let toolConfig = undefined;
        let toolDeclarations = undefined;
        if (tools && tools.length > 0) {
            toolDeclarations = tools.map((t: any) => ({
                name: t.function.name,
                description: t.function.description,
                parameters: t.function.parameters
            }));
            toolConfig = { functionCallingConfig: { mode: 'AUTO' } };
        }

        const requestBody: any = {
            contents,
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 100,
            }
        };

        if (toolDeclarations) {
            requestBody.tools = [{ functionDeclarations: toolDeclarations }];
            requestBody.toolConfig = toolConfig;
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GOOGLE_AI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Gemini API error:', errorData);
            return null;
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];

        if (!candidate) {
            console.error('❌ No response candidate from Gemini');
            return null;
        }

        // Check for function calls
        const functionCall = candidate.content?.parts?.find((p: any) => p.functionCall);
        if (functionCall) {
            return {
                content: null,
                tool_calls: [{
                    id: `call_${Date.now()}`,
                    type: 'function',
                    function: {
                        name: functionCall.functionCall.name,
                        arguments: JSON.stringify(functionCall.functionCall.args || {})
                    }
                }]
            };
        }

        // Return text response
        const textContent = candidate.content?.parts?.map((p: any) => p.text).join('') || '';
        return { content: textContent, tool_calls: null };

    } catch (error) {
        console.error('❌ Error generating AI response:', error);
        return null;
    }
}

/**
 * Builds the system prompt using agent configuration and contact context
 */
function buildSystemPrompt(agentName: string, description: string, config: any, contactContext?: string | null): string {
    // START with critical rules so they take precedence
    let prompt = `REGLAS OBLIGATORIAS (DEBES SEGUIR):
1. Responde con 2-3 mensajes CORTOS separados por [MSG]
2. Cada mensaje max 15 palabras
3. NO preguntes "quieres saber más" o "te puedo ayudar en algo más" NUNCA
4. NO uses emojis ni signos de exclamación
5. Tono casual, como amigo
6. Solo usa ? al final (nunca ¿)

FORMATO CORRECTO: "si claro[MSG]para que lo necesitas"
FORMATO INCORRECTO: "Sí, por supuesto. Te puedo ayudar con eso. ¿Te gustaría saber más?"

---

${description || `You are ${agentName}.`}`;

    // Add identity information if configured
    if (config?.assistantName || config?.companyName || config?.ownerName) {
        prompt += `\n\nIDENTITY:`;
        if (config.assistantName) prompt += ` Name: ${config.assistantName}.`;
        if (config.companyName) prompt += ` Company: ${config.companyName}.`;
        if (config.ownerName) prompt += ` Boss: ${config.ownerName}.`;
    }

    // Add business information if configured
    if (config?.businessNiche || config?.clientGoals || config?.offerDetails) {
        prompt += `\n\nBUSINESS:`;
        if (config.businessNiche) prompt += ` Niche: ${config.businessNiche}.`;
        if (config.clientGoals) prompt += ` Goals: ${config.clientGoals}.`;
        if (config.offerDetails) prompt += ` Offer: ${config.offerDetails}.`;
    }

    // Add tone guidelines if configured
    if (config?.toneGuidelines) {
        prompt += `\n\nSTYLE: ${config.toneGuidelines}`;
    }

    // Add additional context if exists
    if (config?.additionalContext) {
        prompt += `\n\nCONTEXT: ${config.additionalContext}`;
    }

    // Add conversation examples if they exist
    if (config?.conversationExamples) {
        prompt += `\n\nEXAMPLES:\n${config.conversationExamples}`;
    }

    // If there's saved context about the contact, include it
    if (contactContext) {
        prompt += `\n\nMEMORY ABOUT THIS LEAD: ${contactContext}`;
    }

    // If calendar capabilities are enabled, add minimal context
    if (config?.enableMeetingScheduling === true) {
        const now = new Date();
        const timezone = config?.meetingTimezone || 'America/Argentina/Buenos_Aires';
        const currentDateTime = now.toLocaleString('en-US', {
            timeZone: timezone,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        prompt += `\n\nCALENDAR: Now is ${currentDateTime} (${timezone}). Work hours: ${config?.meetingAvailableHoursStart || '09:00'}-${config?.meetingAvailableHoursEnd || '18:00'}. Use check_availability before proposing times. Ask for email before scheduling.`;
    }

    // CRITICAL: These rules go at the END so the AI follows them
    prompt += `

#####################
MANDATORY RULES - FOLLOW OR FAIL
#####################

FORMAT: You MUST use [MSG] to separate messages. Write 2-3 short messages.
EXAMPLE: "si claro[MSG]con que te puedo ayudar"
EXAMPLE: "ah ok[MSG]cuéntame más"

PROHIBIDO / FORBIDDEN:
- NO emojis
- NO exclamation marks (!)
- NO "¿" - only use "?" at the end
- NO asking "quieres saber más?" or "te gustaría más info?" - NEVER
- NO long paragraphs
- NO formal/robotic language

OBLIGATORIO:
- Mensajes CORTOS (max 15 palabras cada uno)
- Tono casual, como amigo
- Si haces pregunta, termina ahí el mensaje
- Usa [MSG] entre cada mensaje

EJEMPLO CORRECTO:
si, funciona con instagram[MSG]lo usas para tu negocio?

EJEMPLO INCORRECTO:
Sí, setterapp puede integrarse con Instagram para ayudarte a gestionar leads. ¿Te gustaría saber más sobre cómo funciona?`;

    return prompt;
}

// Automatic lead status detection function removed - now manual by user
// Lead classification is done manually from the UI via a dropdown selector

