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

        // FACEBOOK INTEGRATION DISABLED - Código comentado temporalmente
        // Preferir Page Access Token desde la integración de Facebook (flujo recomendado)
        // (la UI crea/actualiza una integración `type=facebook` con `page_access_token`)
        // const { data: facebookIntegration } = await supabase
        //   .from('integrations')
        //   .select('config')
        //   .eq('type', 'facebook')
        //   .eq('user_id', userId)
        //   .eq('status', 'connected')
        //   .maybeSingle();
        //
        // const pageAccessToken =
        //   facebookIntegration?.config?.page_access_token ||
        //   instagramIntegration?.config?.page_access_token;
        //
        // if (pageAccessToken) {
        //   try {
        //     const res = await fetch(
        //       `https://graph.facebook.com/v24.0/${senderId}?fields=name,username,profile_pic&access_token=${encodeURIComponent(pageAccessToken)}`,
        //       { method: 'GET' }
        //     );
        //     const data = await res.json().catch(() => null);
        //     if (res.ok && data && !data.error) {
        //       return {
        //         name: data.name || null,
        //         username: data.username || null,
        //         profile_picture: data.profile_pic || null,
        //       };
        //     }
        //     if (debugEnabled && data?.error) {
        //       console.warn('⚠️ User Profile API error:', {
        //         message: data.error?.message,
        //         code: data.error?.code,
        //         subcode: data.error?.error_subcode,
        //         fbtrace_id: data.error?.fbtrace_id,
        //       });
        //     }
        //   } catch {
        //     // ignore
        //   }
        // }

        // Fallback legacy (tokens antiguos) - usar access_token de integración IG si existe
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
                    // Meta usa code=190 para token inválido/expirado/revocado/no parseable o tipo incorrecto.
                    if (data.error.code === 190 || data.error.code === '190') {
                        if (debugEnabled) console.warn('⚠️ Token inválido o no autorizado (code 190). No se puede obtener perfil.', {
                            message: data.error?.message,
                            code: data.error?.code,
                            subcode: data.error?.error_subcode,
                            fbtrace_id: data.error?.fbtrace_id,
                        });
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
                    if (errorData.error?.code === 190 || errorData.error?.code === '190') {
                        if (debugEnabled) console.warn('⚠️ Token inválido o no autorizado (code 190). No se puede obtener perfil.', {
                            message: errorData.error?.message,
                            code: errorData.error?.code,
                            subcode: errorData.error?.error_subcode,
                            fbtrace_id: errorData.error?.fbtrace_id,
                        });
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
                    if (data.error.code === 190 || data.error.code === '190') {
                        if (debugEnabled) console.warn('⚠️ Token inválido o no autorizado (code 190). No se puede obtener perfil.', {
                            message: data.error?.message,
                            code: data.error?.code,
                            subcode: data.error?.error_subcode,
                            fbtrace_id: data.error?.fbtrace_id,
                        });
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
                    if (errorData.error?.code === 190 || errorData.error?.code === '190') {
                        if (debugEnabled) console.warn('⚠️ Token inválido o no autorizado (code 190). No se puede obtener perfil.', {
                            message: errorData.error?.message,
                            code: errorData.error?.code,
                            subcode: errorData.error?.error_subcode,
                            fbtrace_id: errorData.error?.fbtrace_id,
                        });
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
            // Instagram puede enviar timestamp en milisegundos o segundos
            // Si es mayor que 1e12, está en milisegundos
            // Algunos payloads pueden no incluir timestamp o venir como string
            const rawTimestamp = (typeof event.timestamp === 'number' && Number.isFinite(event.timestamp))
                ? event.timestamp
                : (typeof event.timestamp === 'string' && event.timestamp.trim() !== '' && Number.isFinite(Number(event.timestamp)) ? Number(event.timestamp) : null);

            const safeIso = (ms: number) => {
                const d = new Date(ms);
                return Number.isFinite(d.getTime()) ? d.toISOString() : null;
            };

            // Determinar si está en milisegundos o segundos
            // Los timestamps en milisegundos son típicamente > 1e12 (año 2001)
            // Los timestamps en segundos son típicamente < 1e10 (año 2286)
            let timestampInMs: number = Date.now();
            let timestampInSeconds: number = Math.floor(Date.now() / 1000);

            if (rawTimestamp !== null) {
                if (rawTimestamp > 1e12) {
                    // Está en milisegundos
                    timestampInMs = rawTimestamp;
                    timestampInSeconds = Math.floor(rawTimestamp / 1000);
                } else {
                    // Está en segundos
                    timestampInSeconds = rawTimestamp;
                    timestampInMs = rawTimestamp * 1000;
                }
            }

            // Validar que el timestamp sea razonable (entre 2000 y 2100)
            const dateFromTimestamp = new Date(timestampInMs);
            const year = dateFromTimestamp.getFullYear();
            const isValidDate = !isNaN(dateFromTimestamp.getTime()) && year >= 2000 && year <= 2100;

            if (!isValidDate) {
                console.error('❌ Invalid timestamp detected:', {
                    rawTimestamp,
                    timestampInMs,
                    timestampInSeconds,
                    dateFromTimestamp: safeIso(timestampInMs),
                    year,
                    isValidDate
                });
                // Usar timestamp actual como fallback
                timestampInMs = Date.now();
                timestampInSeconds = Math.floor(Date.now() / 1000);
                console.log('⚠️ Using current timestamp as fallback:', {
                    timestampInMs,
                    timestampInSeconds,
                    date: safeIso(timestampInMs)
                });
            }

            // Asegurarse de que timestampInMs sea un número válido
            if (!Number.isFinite(timestampInMs) || timestampInMs <= 0) {
                console.error('❌ timestampInMs is not a valid number:', timestampInMs);
                timestampInMs = Date.now();
                timestampInSeconds = Math.floor(Date.now() / 1000);
            }

            const messageId = message.mid || message.id;
            const messageText = message.text || '';

            // Security: Log only metadata, never message content
            console.log('📩 Message received:', {
                messageId,
                timestamp: safeIso(timestampInMs),
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

                const { data: savedMessage, error: messageError } = await supabase
                    .from('messages')
                    .upsert(
                        {
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
                                raw_timestamp: rawTimestamp,
                            },
                        },
                        {
                            onConflict: 'user_id,platform_message_id',
                            ignoreDuplicates: true,
                        }
                    )
                    .select('id')
                    .single();

                if (messageError) {
                    console.error('❌ Error saving message:', messageError);
                    console.error('❌ Error details:', JSON.stringify(messageError, null, 2));
                } else {
                    console.log('✅ Message saved successfully with ID:', savedMessage?.id);

                    // 🤖 Generar y enviar respuesta automática con IA
                    // Esta función se ejecuta de forma asíncrona sin bloquear la respuesta del webhook
                    generateAndSendAutoReply(userId, conversationId, senderId, messageText)
                        .catch(error => {
                            console.error('❌ Error en respuesta automática:', error);
                            // No lanzar el error para no afectar el webhook
                        });

                    // 📊 Detectar estado del lead automáticamente
                    // Esta función se ejecuta de forma asíncrona sin bloquear la respuesta del webhook
                    detectLeadStatusAsync(conversationId)
                        .catch(error => {
                            console.error('❌ Error detectando estado del lead:', error);
                            // No lanzar el error para no afectar el webhook
                        });
                }
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
 * Construye el system prompt basado en la configuración del agente
 */
function buildSystemPrompt(agentName: string, description: string, config: any): string {
    let prompt = `Eres ${agentName || 'un asistente de IA'}.\n\n`;

    if (description) {
        prompt += `Descripción: ${description}\n\n`;
    }

    if (config?.assistantName) {
        prompt += `Tu nombre es ${config.assistantName}.\n`;
    }
    if (config?.companyName) {
        prompt += `Trabajas para ${config.companyName}.\n`;
    }
    if (config?.ownerName) {
        prompt += `El propietario es ${config.ownerName}.\n`;
    }

    if (config?.businessNiche) {
        prompt += `\nNicho de negocio: ${config.businessNiche}\n`;
    }
    if (config?.clientGoals) {
        prompt += `\nObjetivos que ayudas a lograr: ${config.clientGoals}\n`;
    }
    if (config?.offerDetails) {
        prompt += `\nDetalles de la oferta: ${config.offerDetails}\n`;
    }
    if (config?.importantLinks && config.importantLinks.length > 0) {
        prompt += `\nEnlaces importantes:\n${config.importantLinks.map((link: string) => `- ${link}`).join('\n')}\n`;
    }

    if (config?.openingQuestion) {
        prompt += `\nTu pregunta de apertura es: "${config.openingQuestion}"\n`;
    }

    if (config?.toneGuidelines) {
        prompt += `\nGuías de tono: ${config.toneGuidelines}\n`;
    }
    if (config?.additionalContext) {
        prompt += `\nContexto adicional: ${config.additionalContext}\n`;
    }

    // Instrucciones específicas para agendamiento de reuniones
    if (config?.enableMeetingScheduling) {
        prompt += `\n\n=== AGENDAMIENTO DE REUNIONES ===\n`;
        prompt += `Tienes la capacidad de agendar reuniones automáticamente en Google Calendar usando la función schedule_meeting.\n\n`;

        prompt += `🔧 IMPORTANTE - CÓMO AGENDAR:\n`;
        prompt += `Una vez que tengas el EMAIL, NOMBRE y FECHA/HORA del lead, DEBES llamar a la función schedule_meeting.\n`;
        prompt += `NO digas "te agendo la reunión" a menos que primero llames a la función.\n`;
        prompt += `La función schedule_meeting hará el agendamiento real en Google Calendar.\n\n`;

        prompt += `CUÁNDO OFRECER UNA REUNIÓN:\n`;
        prompt += `- Cuando el lead muestre interés genuino en el producto/servicio\n`;
        prompt += `- Después de responder sus preguntas principales\n`;
        prompt += `- Cuando mencione que quiere saber más detalles\n`;
        prompt += `- Cuando pregunte sobre precios, planes o cómo funciona\n`;
        prompt += `- Si el lead menciona que quiere hablar con alguien\n\n`;

        prompt += `INFORMACIÓN QUE DEBES RECOPILAR (EN ESTE ORDEN):\n`;
        prompt += `1. ✅ CORREO ELECTRÓNICO (OBLIGATORIO):\n`;
        prompt += `   - Ejemplo: "Para enviarte la invitación de calendario, ¿cuál es tu correo electrónico?"\n`;
        prompt += `   - Ejemplo: "Perfecto! Para agendarte, necesito tu email para enviarte la invitación."\n`;
        prompt += `   - SIN CORREO NO SE PUEDE AGENDAR - es absolutamente necesario\n\n`;

        prompt += `2. ✅ NOMBRE COMPLETO (si no lo tienes ya):\n`;
        prompt += `   - Ejemplo: "¿Cómo te llamas?" o "¿Cuál es tu nombre completo?"\n`;
        prompt += `   - Necesario para personalizar la invitación\n\n`;

        prompt += `3. ✅ FECHA Y HORA PREFERIDA:\n`;
        prompt += `   - Ejemplo: "¿Qué día y hora te viene mejor? Tengo disponibilidad ${config.meetingAvailableHoursStart || '9:00'} a ${config.meetingAvailableHoursEnd || '18:00'}"\n`;
        prompt += `   - Ejemplo: "¿Prefieres mañana por la mañana o tarde?"\n`;
        prompt += `   - Duración de la reunión: ${config.meetingDuration || 30} minutos\n\n`;

        prompt += `4. ⚠️ NÚMERO DE TELÉFONO (OPCIONAL):\n`;
        prompt += `   - Solo si es necesario para la reunión virtual o confirmación\n`;
        prompt += `   - Ejemplo: "¿Tienes un número de WhatsApp para enviarte el recordatorio?"\n\n`;

        prompt += `FLUJO DE CONVERSACIÓN RECOMENDADO:\n`;
        prompt += `1. Califica al lead (identifica su interés/necesidad)\n`;
        prompt += `2. Responde sus preguntas principales\n`;
        prompt += `3. Ofrece una reunión para profundizar: "¿Te gustaría que agendemos una llamada de ${config.meetingDuration || 30} minutos para revisar esto con más detalle?"\n`;
        prompt += `4. Si acepta, pide el correo PRIMERO: "Perfecto! ¿Cuál es tu correo electrónico para enviarte la invitación?"\n`;
        prompt += `5. Luego pide nombre (si no lo tienes)\n`;
        prompt += `6. Finalmente coordina fecha/hora\n`;
        prompt += `7. Una vez que tengas EMAIL + NOMBRE + FECHA/HORA: LLAMA A LA FUNCIÓN schedule_meeting\n`;
        prompt += `8. DESPUÉS de llamar a la función, confirma al lead que la reunión fue agendada\n\n`;

        prompt += `EJEMPLO DE CONVERSACIÓN EXITOSA:\n`;
        prompt += `Lead: "Me interesa saber más sobre sus servicios de coaching"\n`;
        prompt += `Tú: "¡Genial! Te puedo explicar cómo funciona nuestro programa. ¿Te gustaría agendar una llamada de ${config.meetingDuration || 30} minutos para que veamos si es lo que necesitas?"\n`;
        prompt += `Lead: "Sí, me gustaría"\n`;
        prompt += `Tú: "Perfecto! Para enviarte la invitación de calendario, ¿cuál es tu correo electrónico?"\n`;
        prompt += `Lead: "juan@email.com"\n`;
        prompt += `Tú: "Excelente Juan! ¿Qué día y hora te viene mejor? Tengo disponibilidad de ${config.meetingAvailableHoursStart || '9:00'} a ${config.meetingAvailableHoursEnd || '18:00'}"\n`;
        prompt += `Lead: "Mañana a las 3pm"\n`;
        prompt += `Tú: [AQUÍ LLAMAS A schedule_meeting con lead_email="juan@email.com", lead_name="Juan", preferred_datetime="2025-12-26T15:00:00"]\n`;
        prompt += `Tú: "Listo! Ya te agendé para mañana a las 3:00 PM. Te llegará la invitación a juan@email.com con el link de google meet"\n\n`;

        prompt += `REGLAS ESTRICTAS PARA AGENDAR:\n`;
        prompt += `❌ NUNCA digas "te agendo" o "ya agendé" sin PRIMERO llamar a la función schedule_meeting\n`;
        prompt += `❌ NUNCA agendes sin tener el correo electrónico\n`;
        prompt += `❌ NUNCA asumas el correo - siempre pregúntalo explícitamente\n`;
        prompt += `❌ NUNCA agendes sin confirmar fecha/hora con el lead\n`;
        prompt += `✅ SIEMPRE usa la función schedule_meeting cuando tengas email + nombre + fecha/hora\n`;
        prompt += `✅ SIEMPRE confirma después de llamar a la función\n`;
        prompt += `✅ SIEMPRE menciona que recibirá una invitación por correo\n`;
        prompt += `✅ SIEMPRE sé amable si el lead no quiere dar su email - ofrece alternativas\n\n`;
    }

    prompt += `\n\n=== ESTILO DE COMUNICACIÓN NATURAL ===\n`;
    prompt += `Escribe como una persona REAL desde el celular, NO como un robot:\n\n`;

    prompt += `✅ SÍ HACER:\n`;
    prompt += `- Escribe de forma casual y conversacional, como en WhatsApp/Instagram\n`;
    prompt += `- Usa minúsculas de forma natural (como "hola" en lugar de "Hola" a menos que sea inicio de oración)\n`;
    prompt += `- Usa contracciones y lenguaje coloquial: "que" en vez de "qué" cuando sea natural\n`;
    prompt += `- Mensajes cortos y directos, como textos reales\n`;
    prompt += `- Pregunta cosas de forma simple: "como te llamas?" "que dia te viene mejor?"\n`;
    prompt += `- Usa puntos suspensivos para pausas naturales si es apropiado\n`;
    prompt += `- Emojis MUY ocasionales y solo cuando sean genuinos (1-2 por conversación máximo)\n\n`;

    prompt += `❌ NO HACER:\n`;
    prompt += `- NO uses mayúsculas exageradas donde nadie las usaría en el celular\n`;
    prompt += `- NO escribas como ensayo formal o email corporativo\n`;
    prompt += `- NO uses frases robóticas como "En qué puedo asistirle" o "Estoy a su disposición"\n`;
    prompt += `- NO uses tildes en TODAS las palabras (solo donde sea natural para alguien escribiendo rápido)\n`;
    prompt += `- NO seas excesivamente formal o ceremonioso\n`;
    prompt += `- NO uses signos de exclamación en todo (!!! ¡¡¡)\n`;
    prompt += `- NO fuerces emojis en cada mensaje\n\n`;

    prompt += `EJEMPLOS CORRECTOS vs INCORRECTOS:\n\n`;
    prompt += `❌ MAL: "¡Hola! ¿En qué puedo asistirle el día de hoy? Estaré encantado de ayudarle con toda la información que necesite. 😊"\n`;
    prompt += `✅ BIEN: "hola! en que te puedo ayudar?"\n\n`;

    prompt += `❌ MAL: "Perfecto, necesitaría que me proporcionara su correo electrónico para poder enviarle la invitación correspondiente."\n`;
    prompt += `✅ BIEN: "perfecto, cual es tu correo para enviarte la invitacion?"\n\n`;

    prompt += `❌ MAL: "¡Excelente! ¿Cuál sería su disponibilidad para coordinar la reunión? 📅✨"\n`;
    prompt += `✅ BIEN: "genial, que dia te viene mejor?"\n\n`;

    prompt += `❌ MAL: "Muchas gracias por su tiempo. Quedo a su entera disposición para cualquier consulta adicional."\n`;
    prompt += `✅ BIEN: "perfecto, cualquier cosa me avisas"\n\n`;

    prompt += `\n\nINSTRUCCIONES GENERALES:\n`;
    prompt += `- Responde de manera natural, amigable y profesional.\n`;
    prompt += `- Mantén las conversaciones enfocadas y útiles.\n`;
    prompt += `- Sé conciso pero completo en tus respuestas.\n`;
    prompt += `- Si no sabes algo, admítelo honestamente.\n`;
    prompt += `- Siempre mantén el tono y estilo definido en las guías de tono.\n`;
    prompt += `- Escribe como si estuvieras chateando desde tu celular, no escribiendo un documento.\n`;

    return prompt;
}

/**
 * Define el tool/function para agendar reuniones
 */
function getMeetingSchedulingTool() {
    return {
        type: 'function',
        function: {
            name: 'schedule_meeting',
            description: 'Agenda una reunión con el lead cuando tenga toda la información necesaria: email, nombre completo y fecha/hora preferida',
            parameters: {
                type: 'object',
                properties: {
                    lead_email: {
                        type: 'string',
                        description: 'Email del lead para enviarle la invitación de calendario'
                    },
                    lead_name: {
                        type: 'string',
                        description: 'Nombre completo del lead'
                    },
                    preferred_datetime: {
                        type: 'string',
                        description: 'Fecha y hora preferida para la reunión en formato ISO 8601. Si el lead dice "mañana a las 3pm", calcular la fecha exacta basándose en la fecha/hora actual y convertir a formato ISO.'
                    },
                    lead_phone: {
                        type: 'string',
                        description: 'Número de teléfono del lead (opcional)'
                    }
                },
                required: ['lead_email', 'lead_name']
            }
        }
    };
}

/**
 * Genera una respuesta usando OpenAI con function calling
 */
async function generateAIResponse(systemPrompt: string, conversationHistory: any[], userMessage: string, enableMeetingScheduling: boolean = false) {
    if (!OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY no está configurada');
        return null;
    }

    try {
        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: userMessage }
        ];

        const requestBody: any = {
            model: 'gpt-4o-mini',
            messages: messages,
            temperature: 0.7,
            max_tokens: 500
        };

        // Agregar tools si el agente tiene habilitado el agendamiento de reuniones
        if (enableMeetingScheduling) {
            requestBody.tools = [getMeetingSchedulingTool()];
            requestBody.tool_choice = 'auto'; // El modelo decide cuándo usar la función
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
        const message = data.choices[0].message;

        // Retornar el mensaje completo (puede incluir tool_calls)
        return message;
    } catch (error) {
        console.error('❌ Error generating AI response:', error);
        return null;
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

        // 4. Generar respuesta con IA (con function calling si está habilitado)
        const enableMeetingScheduling = agent.config?.enableMeetingScheduling || false;
        const aiMessage = await generateAIResponse(systemPrompt, conversationHistory, inboundMessage, enableMeetingScheduling);

        if (!aiMessage) {
            console.error('❌ No se pudo generar respuesta con IA');
            return;
        }

        console.log('✅ AI response generated successfully');
        console.log('📊 Response type:', {
            hasContent: !!aiMessage.content,
            hasToolCalls: !!aiMessage.tool_calls,
            toolCallsCount: aiMessage.tool_calls?.length || 0
        });

        // 5. Verificar si el modelo quiere agendar una reunión (tool_calls)
        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
            console.log('📅 [AutoReply] El modelo quiere agendar una reunión');
            console.log('📋 [AutoReply] Tool calls:', JSON.stringify(aiMessage.tool_calls, null, 2));

            for (const toolCall of aiMessage.tool_calls) {
                if (toolCall.function.name === 'schedule_meeting') {
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log('📅 [AutoReply] Tool call arguments (raw):', toolCall.function.arguments);
                    console.log('📅 [AutoReply] Tool call arguments (parsed):', args);

                    // Llamar a la función de crear reunión
                    const meetingResult = await createMeetingForLead(
                        userId,
                        conversationId,
                        args.lead_email,
                        args.lead_name,
                        args.preferred_datetime,
                        args.lead_phone,
                        agent
                    );

                    console.log('📅 [AutoReply] Meeting creation result:', meetingResult);

                    if (meetingResult.success) {
                        // Enviar mensaje de confirmación con el link de la reunión
                        const confirmationMessage = `perfecto ${args.lead_name}! te agendé la reunión para el ${formatMeetingDate(meetingResult.meeting.date)}. te llegará la invitación a ${args.lead_email} con el link de google meet: ${meetingResult.meeting.link}`;

                        await sendInstagramMessage(userId, recipientId, confirmationMessage);

                        // Guardar mensaje de confirmación
                        await supabase
                            .from('messages')
                            .upsert({
                                conversation_id: conversationId,
                                user_id: userId,
                                platform_message_id: Date.now().toString(),
                                content: confirmationMessage,
                                direction: 'outbound',
                                message_type: 'text',
                                metadata: {
                                    generated_by: 'ai',
                                    agent_id: agent.id,
                                    model: 'gpt-4o-mini',
                                    meeting_scheduled: true,
                                    meeting_id: meetingResult.meeting.id
                                },
                            }, {
                                onConflict: 'conversation_id,platform_message_id',
                            });

                        console.log('✅ Reunión agendada y confirmación enviada');
                    } else {
                        // Si falló la creación, enviar mensaje explicando el problema
                        console.error('❌ Error creating meeting:', meetingResult.error);
                        const errorMessage = 'disculpa, hubo un problema agendando la reunión. déjame verificar y te confirmo en un momento.';
                        await sendInstagramMessage(userId, recipientId, errorMessage);
                    }

                    return; // No enviar el mensaje de texto normal
                }
            }
        }

        // 6. Si no hay tool_calls, enviar la respuesta de texto normal
        const textContent = aiMessage.content;
        if (!textContent) {
            console.error('❌ No hay contenido de texto en la respuesta');
            return;
        }

        // 7. Enviar respuesta a Instagram
        const sendResult = await sendInstagramMessage(userId, recipientId, textContent);

        if (!sendResult) {
            console.error('❌ No se pudo enviar mensaje a Instagram');
            return;
        }

        // 8. Guardar mensaje enviado en la BD
        const { error: messageError } = await supabase
            .from('messages')
            .upsert(
                {
                    conversation_id: conversationId,
                    user_id: userId,
                    platform_message_id: sendResult.message_id || sendResult.id,
                    content: textContent,
                    direction: 'outbound',
                    message_type: 'text',
                    metadata: {
                        generated_by: 'ai',
                        agent_id: agent.id,
                        model: 'gpt-4o-mini'
                    },
                },
                {
                    onConflict: 'conversation_id,platform_message_id',
                    ignoreDuplicates: true,
                }
            );

        if (messageError) {
            console.error('❌ Error guardando mensaje enviado:', messageError);
        } else {
            console.log('✅ Respuesta automática enviada y guardada correctamente');
        }
    } catch (error) {
        console.error('❌ Error en generateAndSendAutoReply:', error);
    }
}

/**
 * Detecta el estado del lead automáticamente llamando a la Edge Function
 */
async function detectLeadStatusAsync(conversationId: string) {
    try {
        console.log('📊 Detectando estado del lead para conversación:', conversationId);

        const { data, error } = await supabase.functions.invoke('detect-lead-status', {
            body: { conversationId }
        });

        if (error) {
            console.error('❌ Error llamando a detect-lead-status:', error);
            return;
        }

        if (data?.statusChanged) {
            console.log('✅ Estado del lead actualizado:', data.oldStatus, '->', data.newStatus);
            console.log('📝 Razón:', data.reasoning);
        } else {
            console.log('ℹ️ Estado del lead sin cambios:', data?.status || 'unknown');
        }
    } catch (error) {
        console.error('❌ Error detectando estado del lead:', error);
    }
}

/**
 * Crea una reunión para el lead usando la Edge Function create-meeting
 */
async function createMeetingForLead(
    userId: string,
    conversationId: string,
    leadEmail: string,
    leadName: string,
    preferredDatetime: string | undefined,
    leadPhone: string | undefined,
    agent: any
) {
    try {
        const { data, error } = await supabase.functions.invoke('create-meeting', {
            body: {
                conversationId,
                leadName,
                leadEmail,
                leadPhone,
                agentId: agent.id,
                customDate: preferredDatetime
            }
        });

        if (error) {
            console.error('❌ Error creando reunión:', error);
            return { success: false, error };
        }

        return data;
    } catch (error) {
        console.error('❌ Error llamando a create-meeting:', error);
        return { success: false, error };
    }
}

/**
 * Formatea la fecha de la reunión para mostrarla al usuario
 */
function formatMeetingDate(isoDate: string): string {
    const date = new Date(isoDate);
    const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Argentina/Buenos_Aires'
    };
    return date.toLocaleDateString('es-AR', options);
}
