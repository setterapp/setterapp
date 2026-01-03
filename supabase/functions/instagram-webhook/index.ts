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

// CORS headers for responses
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

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

// Plan limits for message checking
const PLAN_LIMITS: Record<string, { messages: number }> = {
    starter: { messages: 2000 },
    growth: { messages: 10000 },
    premium: { messages: Infinity },
};

// Admin emails that bypass limits
const ADMIN_EMAILS = ['info@setterapp.ai', 'reviewer@setterapp.ai', 'mpozzetti@mimetria.com'];

// Helper: Check if user has messages remaining
async function checkMessageLimit(userId: string): Promise<{ canSend: boolean; reason?: string }> {
    try {
        // Get user email to check if admin
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        const userEmail = userData?.user?.email?.toLowerCase() || '';

        if (ADMIN_EMAILS.includes(userEmail)) {
            return { canSend: true };
        }

        // Get subscription
        const { data: subscription } = await supabase
            .from('subscriptions')
            .select('plan, messages_used, status')
            .eq('user_id', userId)
            .maybeSingle();

        // No subscription = no messages (user needs to subscribe)
        if (!subscription) {
            console.log('⚠️ User has no subscription, blocking AI response');
            return { canSend: false, reason: 'no_subscription' };
        }

        // Check if subscription is active
        if (subscription.status !== 'active' && subscription.status !== 'trialing') {
            console.log('⚠️ Subscription not active:', subscription.status);
            return { canSend: false, reason: 'inactive_subscription' };
        }

        const plan = subscription.plan || 'starter';
        const limit = PLAN_LIMITS[plan]?.messages || 2000;
        const used = subscription.messages_used || 0;

        if (used >= limit) {
            console.log(`⚠️ User has reached message limit: ${used}/${limit} (${plan})`);
            return { canSend: false, reason: 'limit_reached' };
        }

        console.log(`✅ Message limit OK: ${used}/${limit} (${plan})`);
        return { canSend: true };
    } catch (error) {
        console.error('Error checking message limit:', error);
        // On error, allow the message (fail open for better UX)
        return { canSend: true };
    }
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
 * Usa el User Profile API (graph.facebook.com con page_access_token) como método principal
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
        console.log('📡 Cache miss, obteniendo perfil desde API para senderId:', senderId);

        // Obtener integración de Instagram
        const { data: instagramIntegration, error: instagramError } = await supabase
            .from('integrations')
            .select('config')
            .eq('type', 'instagram')
            .eq('user_id', userId)
            .eq('status', 'connected')
            .maybeSingle();

        if (instagramError || !instagramIntegration) {
            console.warn('⚠️ No se encontró integración de Instagram');
            return null;
        }

        const debugEnabled = Boolean(instagramIntegration?.config?.debug_webhooks);
        const accessToken = instagramIntegration.config?.access_token;
        const instagramBusinessAccountId = instagramIntegration.config?.instagram_user_id ||
            instagramIntegration.config?.instagram_business_account_id;

        if (!accessToken) {
            if (debugEnabled) console.warn('⚠️ No hay access token disponible para obtener perfil');
            return null;
        }

        // Método 1 (PRINCIPAL): User Profile API con access token de Instagram
        // https://developers.facebook.com/docs/messenger-platform/instagram/features/user-profile/
        try {
            console.log('📡 Intentando User Profile API (graph.facebook.com/v24.0)...');
            const response = await fetch(
                `https://graph.facebook.com/v24.0/${senderId}?fields=name,username,profile_pic&access_token=${accessToken}`,
                { method: 'GET' }
            );

            const responseText = await response.text();
            console.log('📡 User Profile API response:', response.status, responseText.substring(0, 500));

            if (response.ok) {
                try {
                    const data = JSON.parse(responseText);
                    if (!data.error && (data.username || data.name)) {
                        console.log('✅ Perfil obtenido via User Profile API:', {
                            username: data.username,
                            name: data.name,
                            has_pic: !!data.profile_pic
                        });
                        return {
                            name: data.name || null,
                            username: data.username || null,
                            profile_picture: data.profile_pic || null,
                        };
                    }
                    if (data.error) {
                        console.warn('⚠️ User Profile API error:', JSON.stringify(data.error));
                        if (isTokenExpiredError(data)) {
                            console.warn('⚠️ Token expirado/inválido');
                            return null;
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ Error parsing response:', e);
                }
            } else {
                console.warn('⚠️ User Profile API falló:', response.status, responseText.substring(0, 300));
            }
        } catch (error) {
            console.warn('⚠️ Error en User Profile API:', error);
        }

        // Método 2: Intentar con Instagram Graph API directamente
        try {
            console.log('📡 Intentando Instagram Graph API...');
            const response = await fetch(
                `https://graph.instagram.com/v24.0/${senderId}?fields=id,username,name&access_token=${accessToken}`,
                { method: 'GET' }
            );

            if (response.ok) {
                const data = await response.json();
                if (!data.error && (data.username || data.name)) {
                    console.log('✅ Perfil obtenido via Instagram Graph API:', data);
                    return {
                        name: data.name || null,
                        username: data.username || null,
                        profile_picture: null,
                    };
                }
            }
        } catch (error) {
            if (debugEnabled) console.warn('⚠️ Instagram Graph API falló:', error);
        }

        // Método 3: Buscar en conversaciones (más lento pero puede funcionar)
        if (instagramBusinessAccountId) {
            try {
                console.log('📡 Intentando buscar en conversaciones...');
                const convResponse = await fetch(
                    `https://graph.facebook.com/v24.0/${instagramBusinessAccountId}/conversations?fields=participants&access_token=${accessToken}`,
                    { method: 'GET' }
                );

                if (convResponse.ok) {
                    const convData = await convResponse.json();
                    const conversations = convData.data || [];

                    for (const conversation of conversations) {
                        const participants = conversation.participants?.data || [];
                        const participant = participants.find((p: any) => p.id === senderId);
                        if (participant && (participant.username || participant.name)) {
                            console.log('✅ Participante encontrado en conversaciones:', participant);
                            return {
                                name: participant.name || null,
                                username: participant.username || null,
                                profile_picture: participant.profile_pic || null,
                            };
                        }
                    }
                }
            } catch (error) {
                if (debugEnabled) console.warn('⚠️ Búsqueda en conversaciones falló:', error);
            }
        }

        console.warn('⚠️ No se pudo obtener perfil de Instagram después de todos los intentos para:', senderId);
        return null;
    } catch (error) {
        console.error('❌ Error general en getInstagramUserProfile:', error);
        return null;
    }
}

/**
 * Obtiene el user_id asociado a una integración de Instagram
 * Busca SOLO por match exacto del pageId/instagram_business_account_id
 * NO hace fallback a otras integraciones para evitar routing incorrecto de mensajes
 */
async function getUserIdFromPageId(pageId: string): Promise<string | null> {
    try {
        if (!pageId) {
            console.error('❌ No pageId provided');
            return null;
        }

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

        // Log para debugging
        console.log(`🔍 Looking for pageId: ${pageId} among ${integrations.length} integration(s)`);

        // Buscar match exacto del pageId con los IDs guardados
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

            // Log de los IDs que tiene esta integración (sin exponer tokens)
            console.log(`  - Integration ${integration.type} for user ${integration.user_id.substring(0, 8)}... has IDs:`, Array.from(candidateIds));

            if (candidateIds.has(pageId)) {
                console.log('✅ Found integration matching pageId:', pageId, 'for user:', integration.user_id.substring(0, 8) + '...');
                return integration.user_id;
            }
        }

        // NO hacer fallback - si no hay match exacto, es mejor no procesar que procesar con el usuario equivocado
        console.error(`❌ NO MATCH: pageId ${pageId} does not match any integration. Message will not be processed.`);
        console.error(`   This usually means the user needs to reconnect Instagram to get the correct instagram_business_account_id saved.`);
        return null;
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

            // Obtener perfil del usuario (App Review aprobado)
            const APP_REVIEW_APPROVED = true;

            let userProfile = null;
            if (APP_REVIEW_APPROVED) {
                userProfile = await getInstagramUserProfile(userId, senderId);
                if (userProfile?.username) {
                    console.log('✅ Username obtenido:', userProfile.username);
                }
            } else {
                console.log('ℹ️ Profile fetching disabled (APP_REVIEW_APPROVED = false)');
            }

            // Priorizar name sobre username para display_name
            const contactName = userProfile?.name || userProfile?.username || senderId;

            // Crear o actualizar contacto (CRM) - usando UPSERT para evitar race conditions
            let contactId: string | null = null;
            try {
                // Usar upsert con ON CONFLICT para manejar race conditions
                const contactData = {
                    user_id: userId,
                    platform: 'instagram',
                    external_id: senderId,
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
                };

                // Primero intentar upsert (solo actualiza campos específicos si existe)
                const { data: upsertedContact, error: upsertError } = await supabase
                    .from('contacts')
                    .upsert({
                        ...contactData,
                        lead_status: 'cold', // Solo se usa en INSERT, no en UPDATE
                    }, {
                        onConflict: 'user_id,platform,external_id',
                        ignoreDuplicates: false,
                    })
                    .select('id')
                    .single();

                if (upsertError) {
                    // Si falla el upsert, intentar buscar el existente
                    console.warn('⚠️ Contact upsert failed, looking up existing:', upsertError.message);
                    const { data: existingContact } = await supabase
                        .from('contacts')
                        .select('id')
                        .eq('user_id', userId)
                        .eq('platform', 'instagram')
                        .eq('external_id', senderId)
                        .maybeSingle();
                    contactId = existingContact?.id || null;
                } else {
                    contactId = upsertedContact?.id || null;
                }
            } catch (e) {
                console.warn('⚠️ Contact creation error (non-blocking):', e);
                // No romper el webhook por CRM
            }

            // Buscar o crear conversación - usando UPSERT para evitar race conditions
            let conversationId: string | null = null;
            const lastMessageDate = new Date(timestampInMs);
            const lastMessageDateISO = lastMessageDate.toISOString();

            // Primero intentar buscar la conversación existente
            const { data: existingConv, error: findError } = await supabase
                .from('conversations')
                .select('id, unread_count, contact')
                .eq('user_id', userId)
                .eq('platform', 'instagram')
                .eq('platform_conversation_id', senderId)
                .maybeSingle();

            if (findError && findError.code !== 'PGRST116') {
                console.error('❌ Error finding conversation:', findError);
            }

            if (existingConv) {
                conversationId = existingConv.id;

                // Actualizar conversación existente
                const updateData: any = {
                    last_message_at: lastMessageDateISO,
                    unread_count: (existingConv.unread_count || 0) + 1,
                    updated_at: new Date().toISOString(),
                };
                if (contactId) updateData.contact_id = contactId;

                // Actualizar el nombre si tenemos información del perfil y el contacto actual es solo un ID
                if (userProfile && (existingConv.contact === senderId || !existingConv.contact || existingConv.contact.match(/^\d+$/))) {
                    updateData.contact = contactName;
                    updateData.contact_metadata = {
                        username: userProfile.username,
                        name: userProfile.name,
                        profile_picture: userProfile.profile_picture,
                    };
                } else if (userProfile) {
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
                // Crear nueva conversación usando INSERT con manejo de conflicto
                console.log('📅 Creating conversation with date:', {
                    timestampInMs,
                    lastMessageDate: lastMessageDateISO,
                    isValid: !isNaN(lastMessageDate.getTime())
                });

                const conversationData = {
                    user_id: userId,
                    platform: 'instagram',
                    platform_conversation_id: senderId,
                    platform_page_id: pageId,
                    contact_id: contactId,
                    contact: contactName,
                    last_message_at: lastMessageDateISO,
                    unread_count: 1,
                    lead_status: 'cold',
                    contact_metadata: userProfile ? {
                        username: userProfile.username,
                        name: userProfile.name,
                        profile_picture: userProfile.profile_picture,
                    } : {},
                };

                const { data: newConv, error: createError } = await supabase
                    .from('conversations')
                    .upsert(conversationData, {
                        onConflict: 'user_id,platform,platform_conversation_id',
                        ignoreDuplicates: false,
                    })
                    .select('id')
                    .single();

                if (createError) {
                    // Si falla el upsert, puede ser race condition - buscar la conversación existente
                    if (createError.code === '23505') {
                        console.log('⚠️ Race condition detected, looking up existing conversation');
                        const { data: raceConv } = await supabase
                            .from('conversations')
                            .select('id')
                            .eq('user_id', userId)
                            .eq('platform', 'instagram')
                            .eq('platform_conversation_id', senderId)
                            .maybeSingle();

                        if (raceConv) {
                            conversationId = raceConv.id;
                            // Actualizar unread_count ya que es un nuevo mensaje
                            await supabase
                                .from('conversations')
                                .update({
                                    last_message_at: lastMessageDateISO,
                                    updated_at: new Date().toISOString(),
                                })
                                .eq('id', conversationId);
                            console.log('✅ Found conversation after race condition:', conversationId);
                        } else {
                            console.error('❌ Could not find conversation after race condition');
                            return;
                        }
                    } else {
                        console.error('❌ Error creating conversation:', createError);
                        return;
                    }
                } else {
                    conversationId = newConv.id;
                    console.log('✅ Created new conversation:', conversationId);
                }
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
                    return;
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
                        return;
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
            const echoLastMessageDateISO = new Date(timestampInMs).toISOString();

            // Crear o actualizar contacto usando upsert
            let contactId: string | null = null;
            try {
                const { data: upsertedEchoContact, error: contactError } = await supabase
                    .from('contacts')
                    .upsert({
                        user_id: userId,
                        platform: 'instagram',
                        external_id: recipientId,
                        display_name: recipientId,
                        last_message_at: echoLastMessageDateISO,
                        lead_status: 'cold',
                        updated_at: new Date().toISOString(),
                    }, {
                        onConflict: 'user_id,platform,external_id',
                        ignoreDuplicates: false,
                    })
                    .select('id')
                    .single();

                if (contactError) {
                    const { data: existingEchoContact } = await supabase
                        .from('contacts')
                        .select('id')
                        .eq('user_id', userId)
                        .eq('platform', 'instagram')
                        .eq('external_id', recipientId)
                        .maybeSingle();
                    contactId = existingEchoContact?.id || null;
                } else {
                    contactId = upsertedEchoContact?.id || null;
                }
            } catch (e) {
                console.warn('⚠️ Echo contact creation error:', e);
            }

            // Crear conversación usando upsert
            const { data: newConv, error: createError } = await supabase
                .from('conversations')
                .upsert({
                    user_id: userId,
                    platform: 'instagram',
                    platform_conversation_id: recipientId,
                    platform_page_id: pageId,
                    contact_id: contactId,
                    contact: recipientId,
                    last_message_at: echoLastMessageDateISO,
                    unread_count: 0, // Echo messages don't increase unread count
                    lead_status: 'cold',
                }, {
                    onConflict: 'user_id,platform,platform_conversation_id',
                    ignoreDuplicates: false,
                })
                .select('id')
                .single();

            if (createError) {
                // Handle race condition
                if (createError.code === '23505') {
                    const { data: raceConv } = await supabase
                        .from('conversations')
                        .select('id')
                        .eq('user_id', userId)
                        .eq('platform', 'instagram')
                        .eq('platform_conversation_id', recipientId)
                        .maybeSingle();
                    conversationId = raceConv?.id || null;
                } else {
                    console.error('❌ Error creating conversation for echo:', createError);
                    return;
                }
            } else {
                conversationId = newConv?.id || null;
            }

            console.log('✅ Created/found conversation for echo:', conversationId);
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
        console.log('📝 Processing Instagram change:', { field: change.field, hasValue: !!change.value });

        // Handle comment events
        if (change.field === 'comments') {
            await processCommentEvent(change.value, pageId);
            return;
        }

        // Handle other change types if needed
        console.log('ℹ️ Unhandled change field:', change.field);
    } catch (error) {
        console.error('Error processing Instagram change:', error);
    }
}

/**
 * Procesa eventos de comentarios en Instagram
 */
async function processCommentEvent(value: any, pageId: string) {
    try {
        const commentId = value?.id;
        const mediaId = value?.media?.id || value?.media_id;
        const commentText = value?.text || '';
        const commenterId = value?.from?.id;
        const commenterUsername = value?.from?.username;

        console.log('💬 Comment received:', {
            commentId,
            mediaId,
            commenterUsername,
            textPreview: commentText.substring(0, 50)
        });

        if (!commentId || !mediaId || !commenterId) {
            console.warn('⚠️ Missing required comment data');
            return;
        }

        // Get user_id from page
        const userId = await getUserIdFromPageId(pageId);
        if (!userId) {
            console.error('❌ Could not find user_id for pageId:', pageId);
            return;
        }

        // Check if we already processed this comment
        const { data: existingLog } = await supabase
            .from('comment_automation_logs')
            .select('id')
            .eq('comment_id', commentId)
            .maybeSingle();

        if (existingLog) {
            console.log('ℹ️ Comment already processed:', commentId);
            return;
        }

        // Find the post in our database
        const { data: post } = await supabase
            .from('instagram_posts')
            .select('id, post_id')
            .eq('user_id', userId)
            .eq('post_id', mediaId)
            .maybeSingle();

        if (!post) {
            console.log('ℹ️ Post not found in database, syncing not done yet:', mediaId);
            return;
        }

        // Find active automations for this post
        const { data: automations } = await supabase
            .from('comment_automations')
            .select('*')
            .eq('user_id', userId)
            .eq('post_id', post.id)
            .eq('is_active', true);

        if (!automations || automations.length === 0) {
            console.log('ℹ️ No active automations for this post');
            return;
        }

        // Check which automation matches
        let matchedAutomation = null;
        const commentTextLower = commentText.toLowerCase().trim();

        for (const automation of automations) {
            const keywords = automation.trigger_keywords || [];

            // If no keywords, match all comments
            if (keywords.length === 0) {
                matchedAutomation = automation;
                break;
            }

            // Check keywords based on trigger type
            const triggerType = automation.trigger_type || 'contains';

            for (const keyword of keywords) {
                const keywordLower = keyword.toLowerCase();

                if (triggerType === 'exact' && commentTextLower === keywordLower) {
                    matchedAutomation = automation;
                    break;
                } else if (triggerType === 'contains' && commentTextLower.includes(keywordLower)) {
                    matchedAutomation = automation;
                    break;
                } else if (triggerType === 'any') {
                    matchedAutomation = automation;
                    break;
                }
            }

            if (matchedAutomation) break;
        }

        if (!matchedAutomation) {
            console.log('ℹ️ No automation matched the comment keywords');
            return;
        }

        console.log('✅ Matched automation:', matchedAutomation.name);

        // Create log entry
        const { data: logEntry, error: logError } = await supabase
            .from('comment_automation_logs')
            .insert({
                user_id: userId,
                automation_id: matchedAutomation.id,
                post_id: post.id,
                comment_id: commentId,
                commenter_id: commenterId,
                commenter_username: commenterUsername,
                comment_text: commentText,
                status: 'processing'
            })
            .select('id')
            .single();

        if (logError) {
            console.error('❌ Error creating log entry:', logError);
            return;
        }

        // Get Instagram integration for access token
        const { data: integration } = await supabase
            .from('integrations')
            .select('config')
            .eq('type', 'instagram')
            .eq('user_id', userId)
            .eq('status', 'connected')
            .single();

        if (!integration?.config?.access_token) {
            console.error('❌ No Instagram access token found');
            await updateLogStatus(logEntry.id, 'failed', 'No access token');
            return;
        }

        const accessToken = integration.config.access_token;
        let commentReplySent = false;
        let dmSent = false;
        let dmConversationId: string | null = null;

        // 1. Reply to the comment if configured
        const replies = [
            matchedAutomation.comment_reply,
            ...(matchedAutomation.comment_reply_variations || [])
        ].filter(Boolean);

        if (replies.length > 0) {
            // Pick a random reply
            const replyText = replies[Math.floor(Math.random() * replies.length)];
            console.log('📝 Selected reply variation:', replyText);

            try {
                const replyResult = await replyToComment(commentId, replyText, accessToken);
                commentReplySent = !!replyResult;
                console.log('✅ Comment reply sent:', !!replyResult);
            } catch (err) {
                console.error('❌ Error replying to comment:', err);
            }
        } else {
            console.log('ℹ️ No comment reply configured');
        }

        // 2. Send DM
        if (matchedAutomation.response_type === 'manual' && matchedAutomation.dm_message) {
            // Wait for delay if configured
            if (matchedAutomation.dm_delay_seconds > 0) {
                await new Promise(resolve => setTimeout(resolve, matchedAutomation.dm_delay_seconds * 1000));
            }

            // Create or get conversation
            const conversationResult = await getOrCreateConversationForComment(
                userId,
                commenterId,
                commenterUsername,
                pageId
            );

            if (conversationResult) {
                dmConversationId = conversationResult.id;

                // Send the DM
                const dmResult = await sendInstagramMessage(userId, commenterId, matchedAutomation.dm_message);
                if (dmResult) {
                    dmSent = true;

                    // Save the message
                    await supabase.from('messages').insert({
                        conversation_id: dmConversationId,
                        user_id: userId,
                        platform_message_id: dmResult?.message_id || `comment_dm_${Date.now()}`,
                        content: matchedAutomation.dm_message,
                        direction: 'outbound',
                        message_type: 'text',
                        metadata: {
                            triggered_by: 'comment_automation',
                            automation_id: matchedAutomation.id,
                            comment_id: commentId
                        }
                    });

                    console.log('✅ DM sent successfully');
                }
            }
        } else if (matchedAutomation.response_type === 'ai' && matchedAutomation.agent_id) {
            // AI response - create conversation and let AI handle it
            const conversationResult = await getOrCreateConversationForComment(
                userId,
                commenterId,
                commenterUsername,
                pageId
            );

            if (conversationResult) {
                dmConversationId = conversationResult.id;

                // Create initial message context
                const initialMessage = `[User commented on your post: "${commentText}"]`;

                // Trigger AI response
                generateAndSendAutoReply(userId, dmConversationId, commenterId, initialMessage)
                    .then(() => {
                        console.log('✅ AI response triggered for comment');
                    })
                    .catch(err => {
                        console.error('❌ Error in AI response:', err);
                    });

                dmSent = true;
            }
        }

        // Update log status
        await supabase
            .from('comment_automation_logs')
            .update({
                comment_reply_sent: commentReplySent,
                dm_sent: dmSent,
                dm_conversation_id: dmConversationId,
                status: 'completed'
            })
            .eq('id', logEntry.id);

        // Update automation stats
        await supabase
            .from('comment_automations')
            .update({
                triggers_count: (matchedAutomation.triggers_count || 0) + 1,
                last_triggered_at: new Date().toISOString()
            })
            .eq('id', matchedAutomation.id);

        console.log('✅ Comment automation completed');

    } catch (error) {
        console.error('❌ Error processing comment event:', error);
    }
}

/**
 * Reply to an Instagram comment
 */
async function replyToComment(commentId: string, message: string, accessToken: string): Promise<any> {
    try {
        const response = await fetch(
            `https://graph.instagram.com/v24.0/${commentId}/replies`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    access_token: accessToken
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ Error replying to comment:', data);
            return null;
        }

        return data;
    } catch (error) {
        console.error('❌ Error in replyToComment:', error);
        return null;
    }
}

/**
 * Get or create a conversation for a commenter
 */
async function getOrCreateConversationForComment(
    userId: string,
    commenterId: string,
    commenterUsername: string | undefined,
    pageId: string
): Promise<{ id: string } | null> {
    try {
        // Check for existing conversation
        const { data: existingConv } = await supabase
            .from('conversations')
            .select('id')
            .eq('user_id', userId)
            .eq('platform', 'instagram')
            .eq('platform_conversation_id', commenterId)
            .maybeSingle();

        if (existingConv) {
            return existingConv;
        }

        // Create contact first
        let contactId: string | null = null;
        const contactName = commenterUsername || commenterId;

        const { data: contact } = await supabase
            .from('contacts')
            .upsert({
                user_id: userId,
                platform: 'instagram',
                external_id: commenterId,
                display_name: contactName,
                username: commenterUsername,
                lead_status: 'cold',
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,platform,external_id'
            })
            .select('id')
            .single();

        contactId = contact?.id || null;

        // Create conversation
        const { data: newConv, error } = await supabase
            .from('conversations')
            .insert({
                user_id: userId,
                platform: 'instagram',
                platform_conversation_id: commenterId,
                platform_page_id: pageId,
                contact_id: contactId,
                contact: contactName,
                last_message_at: new Date().toISOString(),
                unread_count: 0,
                lead_status: 'cold'
            })
            .select('id')
            .single();

        if (error) {
            console.error('❌ Error creating conversation:', error);
            return null;
        }

        return newConv;
    } catch (error) {
        console.error('❌ Error in getOrCreateConversationForComment:', error);
        return null;
    }
}

/**
 * Update log status helper
 */
async function updateLogStatus(logId: string, status: string, errorMessage?: string) {
    await supabase
        .from('comment_automation_logs')
        .update({
            status,
            error_message: errorMessage
        })
        .eq('id', logId);
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
 * Obtiene las knowledge bases asociadas a un agent
 */
async function getAgentKnowledgeBases(agentId: string): Promise<string[]> {
    try {
        const { data: knowledgeBases, error } = await supabase
            .from('knowledge_bases')
            .select('name, content')
            .eq('agent_id', agentId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('❌ Error getting knowledge bases:', error);
            return [];
        }

        if (!knowledgeBases || knowledgeBases.length === 0) {
            return [];
        }

        console.log(`📚 Found ${knowledgeBases.length} knowledge base(s) for agent`);

        // Return formatted knowledge base content
        return knowledgeBases.map(kb => `[${kb.name}]\n${kb.content}`);
    } catch (error) {
        console.error('❌ Error getting knowledge bases:', error);
        return [];
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
 * Envía un mensaje a Instagram usando config ya cargada (más eficiente para múltiples mensajes)
 */
async function sendInstagramMessageWithConfig(userId: string, recipientId: string, message: string, config: any) {
    try {
        const accessToken = config?.access_token;
        const rawId = config?.instagram_user_id;
        const instagramUserId = rawId ? String(rawId) : null;

        if (!accessToken || !instagramUserId) {
            console.error('❌ Faltan credenciales de Instagram en config');
            return null;
        }

        console.log('📤 Enviando mensaje a Instagram:', {
            instagramUserId,
            recipientId: String(recipientId),
            messageLength: message.length,
            messagePreview: message.substring(0, 50)
        });

        // Enviar mensaje usando Instagram Messaging API
        const sendUrl = `https://graph.instagram.com/v24.0/${instagramUserId}/messages`;
        const requestBody = {
            recipient: { id: String(recipientId) },
            message: { text: message }
        };

        const response = await fetch(sendUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        const responseText = await response.text();
        let responseData: any = {};
        try {
            responseData = JSON.parse(responseText);
        } catch {
            responseData = { raw: responseText };
        }

        // Log para debugging
        try {
            await supabase.from('api_request_logs').insert({
                user_id: userId,
                platform: 'instagram',
                endpoint: sendUrl,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ***' },
                body: requestBody,
                response_status: response.status,
                response_body: responseData,
                error: response.ok ? null : responseData?.error?.message || responseText
            });
        } catch (logErr) {
            console.warn('⚠️ No se pudo guardar log de API:', logErr);
        }

        if (response.ok) {
            console.log('✅ Mensaje enviado correctamente');
            return responseData;
        }

        // Check for token expiry
        if (responseData?.error?.code === 190 || responseData?.error?.code === '190') {
            console.warn('⚠️ Token de Instagram expirado');
            await supabase
                .from('integrations')
                .update({ status: 'disconnected' })
                .eq('type', 'instagram')
                .eq('user_id', userId);
            return null;
        }

        console.error('❌ Error enviando mensaje:', responseData?.error?.message || responseText);
        return null;

    } catch (error) {
        console.error('❌ Error sending Instagram message:', error);
        return null;
    }
}

/**
 * Envía un mensaje a Instagram (con soporte para mensajes largos y reintentos)
 * @deprecated Use sendInstagramMessageWithConfig for multiple messages
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
        // instagram_user_id es el scoped ID que devuelve /me - es el que va en la URL
        // Convertir a string por si viene como número
        const rawId = integration?.config?.instagram_user_id;
        const instagramUserId = rawId ? String(rawId) : null;

        if (!accessToken || !instagramUserId) {
            console.error('❌ Faltan credenciales de Instagram. Config:', {
                has_token: !!accessToken,
                instagram_user_id: integration?.config?.instagram_user_id,
            });
            return null;
        }

        console.log('📤 Enviando mensaje a Instagram:', {
            instagramUserId,
            recipientId: String(recipientId),
            messageLength: message.length
        });

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

            // Reintentos para errores transitorios (code 2)
            let attempts = 0;
            const maxAttempts = 3;
            let lastError = null;

            while (attempts < maxAttempts) {
                attempts++;

                // Enviar mensaje usando Instagram Messaging API
                // Endpoint: POST /{instagram_user_id}/messages
                const sendUrl = `https://graph.instagram.com/v24.0/${instagramUserId}/messages`;
                const requestBody = {
                    recipient: { id: String(recipientId) },
                    message: { text: part }
                };

                console.log(`📡 POST ${sendUrl}`);
                console.log(`📦 Body:`, JSON.stringify(requestBody));

                const response = await fetch(sendUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody)
                });

                const responseText = await response.text();
                let responseData: any = {};
                try {
                    responseData = JSON.parse(responseText);
                } catch {
                    responseData = { raw: responseText };
                }

                // Guardar el request en la base de datos para debugging
                try {
                    await supabase.from('api_request_logs').insert({
                        user_id: userId,
                        platform: 'instagram',
                        endpoint: sendUrl,
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ***' },
                        body: requestBody,
                        response_status: response.status,
                        response_body: responseData,
                        error: response.ok ? null : responseData?.error?.message || responseText
                    });
                } catch (logErr) {
                    console.warn('⚠️ No se pudo guardar log de API:', logErr);
                }

                if (response.ok) {
                    lastResult = responseData;
                    console.log(`✅ Mensaje parte ${i + 1}/${messageParts.length} enviado`);
                    break;
                }

                lastError = responseData;

                // Si es error transitorio (code 2), reintentar
                if (lastError?.error?.is_transient === true || lastError?.error?.code === 2) {
                    console.warn(`⚠️ Error transitorio (intento ${attempts}/${maxAttempts}):`, lastError?.error?.message);
                    if (attempts < maxAttempts) {
                        // Esperar antes de reintentar (backoff exponencial)
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
                        continue;
                    }
                }

                // Si el token ha expirado (error code 190), marcar la integración como desconectada
                if (lastError?.error?.code === 190 || lastError?.error?.code === '190') {
                    console.warn('⚠️ Token de Instagram expirado, marcando integración como desconectada');
                    await supabase
                        .from('integrations')
                        .update({ status: 'disconnected' })
                        .eq('type', 'instagram')
                        .eq('user_id', userId);
                    return null;
                }

                // Otro error no transitorio
                console.error(`❌ Error enviando mensaje parte ${i + 1}/${messageParts.length}:`, lastError);
                return null;
            }

            // Si agotamos los reintentos
            if (attempts >= maxAttempts && lastError) {
                console.error(`❌ Agotados reintentos. Último error:`, lastError);
                return null;
            }
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

        // 0. Check message limit before generating AI response
        const limitCheck = await checkMessageLimit(userId);
        if (!limitCheck.canSend) {
            console.log(`⚠️ Message limit reached, not generating AI response: ${limitCheck.reason}`);
            return;
        }

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

        // 3.5 Obtener knowledge bases del agente
        const knowledgeBases = await getAgentKnowledgeBases(agent.id);

        // 4. Construir system prompt con el contexto
        const systemPrompt = buildSystemPrompt(agent.name, agent.description, agent.config, contactContext, knowledgeBases);
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
            // Split response on . and ? to send as separate messages (Instagram style)
            // Keep the ? at the end of questions, remove periods
            const messageParts = finalResponse
                .split(/(?<=\?)\s*|(?<=\.)\s*/)  // Split after ? or .
                .map((msg: string) => msg.trim().replace(/\.$/, ''))  // Remove trailing periods
                .filter((msg: string) => msg.length > 0);

            console.log(`📨 Sending ${messageParts.length} message(s):`, messageParts.map(m => m.substring(0, 50)));

            // Get integration config once to avoid repeated DB queries
            const { data: integrationConfig } = await supabase
                .from('integrations')
                .select('config')
                .eq('type', 'instagram')
                .eq('user_id', userId)
                .eq('status', 'connected')
                .single();

            if (!integrationConfig?.config?.access_token) {
                console.error('❌ No Instagram integration found for sending messages');
            } else {
                let successCount = 0;
                for (let i = 0; i < messageParts.length; i++) {
                    const msg = messageParts[i];

                    // Pause between messages to simulate human typing and avoid rate limits
                    if (i > 0) {
                        // Longer delay: 800ms base + variable based on message length
                        const typingDelay = Math.min(Math.max(msg.length * 30, 800), 2000);
                        console.log(`⏳ Waiting ${typingDelay}ms before sending message ${i + 1}...`);
                        await new Promise(resolve => setTimeout(resolve, typingDelay));
                    }

                    // Retry logic for each message part
                    let sendResult = null;
                    let retryCount = 0;
                    const maxRetries = 2;

                    while (retryCount <= maxRetries) {
                        sendResult = await sendInstagramMessageWithConfig(
                            userId,
                            recipientId,
                            msg,
                            integrationConfig.config
                        );

                        if (sendResult) {
                            break;
                        }

                        retryCount++;
                        if (retryCount <= maxRetries) {
                            console.log(`🔄 Retry ${retryCount}/${maxRetries} for message ${i + 1}...`);
                            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                        }
                    }

                    if (!sendResult) {
                        console.error(`❌ Failed to send message ${i + 1}/${messageParts.length} after ${maxRetries} retries`);
                        // Continue trying to send remaining messages instead of breaking
                        continue;
                    }

                    successCount++;
                    // Save each message separately
                    const platformMsgId = sendResult?.message_id;
                    await saveOutboundMessage(conversationId, userId, msg, agent.id, platformMsgId);
                    console.log(`✅ Message ${i + 1}/${messageParts.length} sent (id: ${platformMsgId})`);
                }

                console.log(`📊 Sent ${successCount}/${messageParts.length} messages successfully`);
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

    // Increment messages_used counter in subscription
    try {
        await supabase.rpc('increment_messages_used', { p_user_id: userId });
    } catch {
        console.log('⚠️ Could not increment messages_used (user may not have subscription)');
    }
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
                // Handle tool results
                if (m.role === 'tool') {
                    return {
                        role: 'user',
                        parts: [{
                            functionResponse: {
                                name: m.tool_call_id || 'tool_result',
                                response: { content: m.content }
                            }
                        }]
                    };
                }
                // Handle assistant messages with tool_calls
                if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
                    return {
                        role: 'model',
                        parts: m.tool_calls.map((tc: any) => ({
                            functionCall: {
                                name: tc.function.name,
                                args: JSON.parse(tc.function.arguments || '{}')
                            }
                        }))
                    };
                }
                // Regular text messages
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
                temperature: 0.4,
                maxOutputTokens: 1024,
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
 * Maps language code to accent instructions
 */
function getAccentInstructions(languageAccent: string): string {
    const accentMap: Record<string, string> = {
        'es-ES': 'Habla español de España. Usa "tú" y expresiones españolas.',
        'es-MX': 'Habla español de México. Usa expresiones mexicanas.',
        'es-AR': 'Habla español de Argentina. Usa "vos" y expresiones argentinas.',
        'es-CO': 'Habla español de Colombia. Usa expresiones colombianas.',
        'es-CL': 'Habla español de Chile. Usa expresiones chilenas.',
        'es-PE': 'Habla español de Perú. Usa expresiones peruanas.',
        'en-US': 'Speak American English.',
        'en-GB': 'Speak British English.',
        'pt-BR': 'Fale português do Brasil.',
        'pt-PT': 'Fale português de Portugal.',
        'fr-FR': 'Parle français.',
        'de-DE': 'Sprich Deutsch.',
        'it-IT': 'Parla italiano.',
    };
    return accentMap[languageAccent] || '';
}

/**
 * Builds the system prompt using agent configuration, contact context and knowledge bases
 */
function buildSystemPrompt(agentName: string, description: string, config: any, contactContext?: string | null, knowledgeBases?: string[]): string {
    let prompt = `${description || `You are ${agentName}.`}`;

    // Add language/accent based on config
    const languageAccent = config?.languageAccent || 'es-ES';
    const accentInstructions = getAccentInstructions(languageAccent);
    if (accentInstructions) {
        prompt += `\n\nIDIOMA: ${accentInstructions}`;
    }

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

    // Add knowledge bases content if available
    if (knowledgeBases && knowledgeBases.length > 0) {
        prompt += `\n\nKNOWLEDGE BASE (use this information to answer questions):\n${knowledgeBases.join('\n\n')}`;
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

    // Simple rules at the end
    prompt += `

ESTILO:
- Habla como un amigo por Instagram, casual y directo
- Respuestas cortas la mayoría del tiempo (5-15 palabras)
- Si necesitas explicar algo, puedes usar 2-3 oraciones
- IMPORTANTE: Siempre usa punto (.) al final de cada oración antes de empezar otra
- Sin emojis
- Nunca preguntes "quieres saber más?" ni "te ayudo en algo más?"
- Solo usa ? (nunca ¿)

Ejemplo correcto: "listo, quedó agendada. te llegó el mail?"
Ejemplo incorrecto: "listo, quedó agendada te llegó el mail?"`;

    return prompt;
}

// Automatic lead status detection function removed - now manual by user
// Lead classification is done manually from the UI via a dropdown selector
