import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

// Security: Require all secrets to be configured via environment variables
const VERIFY_TOKEN = Deno.env.get('INSTAGRAM_WEBHOOK_VERIFY_TOKEN');
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';

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
            console.log('⚠️ No matching pageId found, using first connected instagram integration');
            return instagram.user_id;
        }
        console.log('⚠️ No matching pageId found, using first connected integration');
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

        // Solo procesar mensajes entrantes (inbound)
        if (event.message && !event.message.is_echo) {
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

            // TEMPORARY: Skip profile fetching until app review is approved
            // Username requires additional permissions from Meta
            // For now, use sender ID as display name
            const userProfile = null; // Disabled until app review
            console.log('ℹ️ Profile fetching disabled (pending app review), using ID');

            // Usar directamente el senderId como nombre hasta app review
            const displayName = senderId;
            const contactName = senderId;

            // Upsert contacto (CRM) y obtener contact_id
            let contactId: string | null = null;
            try {
                const { data: upsertedContact } = await supabase
                    .from('contacts')
                    .upsert(
                        {
                            user_id: userId,
                            platform: 'instagram',
                            external_id: senderId,
                            display_name: contactName,
                            username: userProfile?.username || null,
                            profile_picture: userProfile?.profile_picture || null,
                            last_message_at: new Date(timestampInMs).toISOString(),
                            lead_status: 'cold', // Estado inicial para nuevos contactos
                            metadata: userProfile ? {
                                username: userProfile.username,
                                name: userProfile.name,
                                profile_picture: userProfile.profile_picture,
                            } : {},
                            updated_at: new Date().toISOString(),
                        },
                        { onConflict: 'user_id,platform,external_id' }
                    )
                    .select('id')
                    .single();

                contactId = upsertedContact?.id || null;
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

                // 🤖 Generar y enviar respuesta automática con IA
                generateAndSendAutoReply(userId, conversationId, senderId, messageText)
                    .catch(error => {
                        console.error('❌ Error en respuesta automática:', error);
                        // No lanzar el error para no afectar el webhook
                    });

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
 */
async function getConversationHistory(conversationId: string, limit: number = 50) {
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
 * Envía un mensaje a Instagram
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
                    message: { text: message }
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Error enviando mensaje a Instagram:', errorData);

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

        const data = await response.json();
        console.log('✅ Message sent to Instagram successfully');
        return data;
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

        // 2. Obtener historial de conversación
        const conversationHistory = await getConversationHistory(conversationId);

        // 3. Construir system prompt
        const systemPrompt = buildSystemPrompt(agent.name, agent.description, agent.config);

        // 4. Definir tools para el agente (solo si tiene Google Calendar conectado)
        const tools = [
            {
                type: 'function',
                function: {
                    name: 'check_availability',
                    description: 'Consulta los eventos ocupados del calendario. SIEMPRE usa esta función ANTES de proponer horarios. Devuelve eventos con start_local/end_local/date_local (horarios en timezone local), work_hours (horario laboral en local), y current_datetime_local (fecha/hora actual en local). USA LOS CAMPOS *_local PARA TUS CÁLCULOS, no los ISO. Encuentra gaps entre eventos ocupados que estén dentro de work_hours.',
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
                    description: 'Agenda una reunión en el calendario. SOLO usa esta función DESPUÉS de que el lead haya confirmado EXPLÍCITAMENTE tanto la fecha/hora como su email. NUNCA inventes o asumas un email. Calcula la fecha/hora en formato ISO 8601 usando current_datetime y timezone de check_availability como referencia.',
                    parameters: {
                        type: 'object',
                        properties: {
                            meeting_date: {
                                type: 'string',
                                description: 'Fecha y hora de la reunión en formato ISO 8601 con timezone. Ejemplo: "2025-12-26T15:00:00.000Z". Calcula correctamente basándote en el current_datetime y timezone que recibiste de check_availability.'
                            },
                            duration_minutes: {
                                type: 'number',
                                description: 'Duración de la reunión en minutos (por defecto 30)'
                            },
                            lead_name: {
                                type: 'string',
                                description: 'Nombre completo del lead tal como te lo dio en la conversación'
                            },
                            lead_email: {
                                type: 'string',
                                description: 'Email del lead que TE DIO EXPLÍCITAMENTE en la conversación. NUNCA inventes, generes o asumas un email. Debe ser EXACTAMENTE el email que el lead escribió. Este campo es OBLIGATORIO.'
                            }
                        },
                        required: ['meeting_date', 'lead_name', 'lead_email']
                    }
                }
            }
        ];

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

            // Llamar a OpenAI con tools
            const aiMessage = await generateAIResponse(messages, tools);

            if (!aiMessage) {
                console.error('❌ No se pudo generar respuesta con IA');
                return;
            }

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
                    } else {
                        toolResult = { error: 'Función desconocida' };
                    }
                } catch (error) {
                    console.error(`❌ Error ejecutando ${functionName}:`, error);
                    toolResult = { error: error instanceof Error ? error.message : 'Error desconocido' };
                }

                // Agregar resultado de la tool a la conversación
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(toolResult)
                });

                console.log(`✅ Resultado de ${functionName}:`, toolResult);
            }

            // Continuar el loop para que OpenAI procese los resultados
        }

        // 7. Enviar respuesta final al usuario
        if (finalResponse) {
            const sendResult = await sendInstagramMessage(userId, recipientId, finalResponse);
            if (sendResult) {
                await saveOutboundMessage(conversationId, userId, finalResponse, agent.id);
                console.log('✅ Respuesta final enviada');
            }
        } else {
            console.warn('⚠️ No se obtuvo respuesta final del agente (máx iteraciones alcanzadas)');
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

// Helper para guardar mensaje outbound
async function saveOutboundMessage(conversationId: string, userId: string, content: string, agentId: string) {
    const metadata = {
        generated_by: 'ai',
        agent_id: agentId,
        model: 'gpt-4o-mini'
    };

    await supabase.from('messages').upsert({
        conversation_id: conversationId,
        user_id: userId,
        platform_message_id: Date.now().toString(),
        content: content,
        direction: 'outbound',
        message_type: 'text',
        metadata: metadata
    }, { onConflict: 'user_id,platform_message_id', ignoreDuplicates: true });
}

/**
 * Genera una respuesta usando OpenAI con soporte para tools
 */
async function generateAIResponse(messages: any[], tools?: any[]) {
    if (!OPENAI_API_KEY) return null;

    try {
        const requestBody: any = {
            model: 'gpt-4o-mini',
            messages: messages,
            temperature: 0.7,
            max_tokens: 500
        };

        // Agregar tools si están disponibles
        if (tools && tools.length > 0) {
            requestBody.tools = tools;
            requestBody.tool_choice = 'auto';
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ OpenAI API error:', errorData);
            return null;
        }

        const data = await response.json();
        return data.choices[0].message;
    } catch (error) {
        console.error('❌ Error generating AI response:', error);
        return null;
    }
}

/**
 * Construye el system prompt simple para chat conversacional
 */
function buildSystemPrompt(agentName: string, description: string, config: any): string {
    let prompt = `Eres ${agentName}.\n\n`;

    if (description) prompt += `${description}\n\n`;

    // Información del agente
    if (config?.assistantName) prompt += `Tu nombre: ${config.assistantName}\n`;
    if (config?.companyName) prompt += `Empresa: ${config.companyName}\n`;
    if (config?.businessNiche) prompt += `Nicho: ${config.businessNiche}\n`;
    if (config?.offerDetails) prompt += `Oferta: ${config.offerDetails}\n\n`;

    // Información de fecha/hora y calendario
    const timezone = config?.meetingTimezone || 'America/Argentina/Buenos_Aires';
    const now = new Date();
    const currentDateTime = now.toLocaleString('es-AR', {
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    prompt += `=== INFORMACIÓN DE CALENDARIO ===\n`;
    prompt += `Fecha y hora actual: ${currentDateTime}\n`;
    prompt += `Zona horaria: ${timezone}\n`;
    if (config?.meetingAvailableHoursStart && config?.meetingAvailableHoursEnd) {
        prompt += `Horario de atención: ${config.meetingAvailableHoursStart} a ${config.meetingAvailableHoursEnd}\n`;
    }
    if (config?.meetingAvailableDays) {
        const daysInSpanish: Record<string, string> = {
            'monday': 'lunes',
            'tuesday': 'martes',
            'wednesday': 'miércoles',
            'thursday': 'jueves',
            'friday': 'viernes',
            'saturday': 'sábado',
            'sunday': 'domingo'
        };
        const daysStr = config.meetingAvailableDays.map((d: string) => daysInSpanish[d] || d).join(', ');
        prompt += `Días disponibles: ${daysStr}\n`;
    }
    prompt += `Duración de reuniones: ${config?.meetingDuration || 30} minutos\n`;

    prompt += `\n📅 CÓMO PROPONER HORARIOS:\n`;
    prompt += `1. Usa check_availability para obtener eventos ocupados de los próximos 10 días\n`;
    prompt += `2. La respuesta incluirá:\n`;
    prompt += `   - current_datetime_local: fecha/hora actual en hora local (usa ESTA, no la versión _iso)\n`;
    prompt += `   - work_hours: horario laboral (ej: 09:00 - 18:00 en hora local)\n`;
    prompt += `   - occupied_events: cada evento tiene start_local, end_local, date_local (usa ESTOS campos)\n`;
    prompt += `3. Analiza TODOS los días (hoy + próximos 10 días) para encontrar gaps disponibles\n`;
    prompt += `4. Propone opciones flexibles:\n`;
    prompt += `   - Ofrece lo MÁS PRONTO disponible (puede ser hoy, mañana, etc.)\n`;
    prompt += `   - TAMBIÉN menciona opciones en días futuros\n`;
    prompt += `   - Si el lead pregunta por una semana específica, muestra opciones de esa semana\n`;
    prompt += `   - Sé flexible y adaptable a las preferencias del lead\n`;
    prompt += `5. Cuando el lead elija un horario, calcula la fecha ISO correctamente y usa schedule_meeting\n\n`;

    prompt += `EJEMPLO 1 - Ofrecer opciones variadas:\n`;
    prompt += `Lead: "¿Cuándo tenés disponible?"\n`;
    prompt += `Tú: "lo más pronto que tengo es hoy a las 15:00. también tengo mañana a las 10am o el lunes que viene a las 14:00. ¿alguna te sirve?"\n\n`;

    prompt += `EJEMPLO 2 - Adaptarse a preferencias:\n`;
    prompt += `Lead: "Esta semana no puedo, ¿y la próxima?"\n`;
    prompt += `Tú: "la semana que viene tengo el lunes 30 a las 11am y 15:00, el miércoles 1 a las 10am, o el viernes 3 a las 14:00"\n\n`;

    prompt += `EJEMPLO 3 - Cálculo de disponibilidad:\n`;
    prompt += `Si check_availability muestra:\n`;
    prompt += `- current_datetime_local: "jueves, 26 de diciembre de 2025, 10:00"\n`;
    prompt += `- work_hours: {start: "09:00", end: "18:00"}\n`;
    prompt += `- occupied_events del día 26: [{"start_local": "14:00", "end_local": "15:00", "date_local": "jueves, 26 de diciembre"}]\n`;
    prompt += `- occupied_events del día 27: [] (ninguno)\n`;
    prompt += `Entonces:\n`;
    prompt += `- HOY (26): disponible 10:00-14:00 y 15:00-18:00\n`;
    prompt += `- MAÑANA (27): disponible todo el día 09:00-18:00\n`;
    prompt += `Ofreces: "tengo disponible hoy a las 15:00 o 16:00, o mañana desde las 9am en adelante"\n\n`;

    prompt += `=== ESTILO DE COMUNICACIÓN ===\n`;
    prompt += `• Natural y conversacional\n`;
    prompt += `• Mensajes cortos (2-3 oraciones máximo)\n`;
    prompt += `• Minúsculas casuales (estilo Instagram/WhatsApp)\n`;
    prompt += `• Tono amigable\n`;
    prompt += `• Sin emojis excesivos (máximo 1-2 por mensaje)\n`;

    return prompt;
}

// Función de detección automática de lead status removida - ahora es manual por el usuario
// La clasificación de leads se hace manualmente desde la UI mediante un selector dropdown

