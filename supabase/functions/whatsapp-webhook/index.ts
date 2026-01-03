import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

// Security: Require all secrets to be configured via environment variables
const VERIFY_TOKEN = Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';

if (!VERIFY_TOKEN) {
    console.error('❌ WHATSAPP_WEBHOOK_VERIFY_TOKEN must be configured');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

console.log(`WhatsApp webhook function initialized`);

Deno.serve(async (req: Request) => {
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

        // Webhook verification (GET)
        if (req.method === 'GET') {
            const mode = url.searchParams.get('hub.mode');
            const token = url.searchParams.get('hub.verify_token');
            const challenge = url.searchParams.get('hub.challenge');

            if (mode === 'subscribe' && token === VERIFY_TOKEN) {
                console.log('✅ Webhook verified successfully');
                return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
            } else {
                console.error('❌ Webhook verification failed');
                return new Response('Verification failed', { status: 403 });
            }
        }

        // Process webhook events (POST)
        if (req.method === 'POST') {
            const body = await req.json();
            console.log('📨 WhatsApp webhook event received');

            if (body.object === 'whatsapp_business_account') {
                for (const entry of body.entry || []) {
                    const phoneNumberId = entry.id;

                    if (entry.changes) {
                        for (const change of entry.changes) {
                            if (change.value?.messages) {
                                for (const event of change.value.messages) {
                                    await processWhatsAppEvent(event, change.value, phoneNumberId);
                                }
                            }
                            if (change.value?.statuses) {
                                for (const status of change.value.statuses) {
                                    console.log('📬 WhatsApp status update:', status.status);
                                }
                            }
                        }
                    }
                }
            }

            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response('Method not allowed', { status: 405 });
    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});

async function getUserIdFromPhoneNumberId(phoneNumberId: string): Promise<string | null> {
    try {
        const { data: integrations, error } = await supabase
            .from('integrations')
            .select('user_id, config')
            .eq('type', 'whatsapp')
            .eq('status', 'connected');

        if (error || !integrations || integrations.length === 0) {
            console.error('❌ No WhatsApp integrations found');
            return null;
        }

        for (const integration of integrations) {
            if (integration.config?.phoneNumberId === phoneNumberId) {
                return integration.user_id;
            }
        }

        // Fallback to first integration
        console.warn('⚠️ FALLBACK: No exact match for phoneNumberId:', phoneNumberId, '- using first WhatsApp integration for user:', integrations[0].user_id);
        return integrations[0].user_id;
    } catch (error) {
        console.error('❌ Error getting user_id:', error);
        return null;
    }
}

async function processWhatsAppEvent(event: any, value: any, phoneNumberId: string) {
    try {
        if (event.from && event.type === 'text') {
            const senderId = event.from;
            const messageId = event.id;
            const messageText = event.text?.body || '';
            const timestamp = parseInt(event.timestamp) * 1000;
            const contactName = value.contacts?.[0]?.profile?.name || senderId;

            const userId = await getUserIdFromPhoneNumberId(phoneNumberId);
            if (!userId) {
                console.error('❌ Could not find user_id');
                return;
            }

            // Crear o actualizar contacto - NO sobrescribir lead_status si ya existe
            let contactId: string | null = null;
            try {
                // Primero buscar si el contacto ya existe
                const { data: existingContact } = await supabase
                    .from('contacts')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('platform', 'whatsapp')
                    .eq('external_id', senderId)
                    .maybeSingle();

                if (existingContact) {
                    // Contacto existe: actualizar SIN tocar lead_status
                    await supabase
                        .from('contacts')
                        .update({
                            display_name: contactName,
                            phone: senderId,
                            last_message_at: new Date(timestamp).toISOString(),
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
                            platform: 'whatsapp',
                            external_id: senderId,
                            display_name: contactName,
                            phone: senderId,
                            last_message_at: new Date(timestamp).toISOString(),
                            lead_status: 'cold',
                        })
                        .select('id')
                        .single();
                    contactId = newContact?.id || null;
                }
            } catch { }

            // Find or create conversation
            let conversationId: string | null = null;
            const { data: existingConv } = await supabase
                .from('conversations')
                .select('id, unread_count')
                .eq('user_id', userId)
                .eq('platform', 'whatsapp')
                .eq('platform_conversation_id', senderId)
                .single();

            if (existingConv) {
                conversationId = existingConv.id;
                await supabase.from('conversations').update({
                    contact: contactName,
                    contact_id: contactId,
                    last_message_at: new Date(timestamp).toISOString(),
                    unread_count: (existingConv.unread_count || 0) + 1,
                    updated_at: new Date().toISOString(),
                }).eq('id', conversationId);
            } else {
                const { data: newConv } = await supabase
                    .from('conversations')
                    .insert({
                        user_id: userId,
                        platform: 'whatsapp',
                        platform_conversation_id: senderId,
                        platform_page_id: phoneNumberId,
                        contact_id: contactId,
                        contact: contactName,
                        last_message_at: new Date(timestamp).toISOString(),
                        unread_count: 1,
                        lead_status: 'cold',
                    })
                    .select('id')
                    .single();
                conversationId = newConv?.id || null;
            }

            // Save message
            if (conversationId && messageText) {
                await supabase.from('messages').insert({
                    conversation_id: conversationId,
                    user_id: userId,
                    platform_message_id: messageId,
                    content: messageText,
                    direction: 'inbound',
                    message_type: 'text',
                    metadata: { sender_id: senderId, phone_number_id: phoneNumberId },
                });

                console.log('✅ Message saved, generating AI response...');

                // Generate AI response async
                generateAndSendAutoReply(userId, conversationId, senderId, messageText, phoneNumberId)
                    .catch(error => console.error('❌ Error en respuesta automática:', error));
            }
        }
    } catch (error) {
        console.error('❌ Error processing WhatsApp event:', error);
    }
}

async function getWhatsAppAgent(userId: string) {
    const { data: agent } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', 'whatsapp')
        .single();
    return agent;
}

async function getConversationHistory(conversationId: string, limit: number = 25) {
    const { data: messages } = await supabase
        .from('messages')
        .select('content, direction')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(limit);

    return (messages || []).reverse().map(msg => ({
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: msg.content
    }));
}

/**
 * Obtiene el contexto guardado del contacto (memoria de largo plazo)
 */
async function getContactContext(conversationId: string): Promise<string | null> {
    try {
        const { data: conversation } = await supabase
            .from('conversations')
            .select('contact_id')
            .eq('id', conversationId)
            .single();

        if (!conversation?.contact_id) return null;

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
        const { data: conversation } = await supabase
            .from('conversations')
            .select('contact_id')
            .eq('id', conversationId)
            .single();

        if (!conversation?.contact_id) {
            console.warn('⚠️ No contact_id found for conversation:', conversationId);
            return false;
        }

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

        // Formatear cada knowledge base
        return knowledgeBases.map(kb => `=== ${kb.name} ===\n${kb.content}`);
    } catch (error) {
        console.error('❌ Error getting knowledge bases:', error);
        return [];
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

function buildSystemPrompt(agentName: string, description: string, config: any, contactContext?: string | null, knowledgeBases?: string[]): string {
    let prompt = description || `Eres ${agentName}.`;

    // Add language/accent based on config
    const languageAccent = config?.languageAccent || 'es-ES';
    const accentInstructions = getAccentInstructions(languageAccent);
    if (accentInstructions) {
        prompt += `\n\nIDIOMA: ${accentInstructions}`;
    }

    // Add identity information if configured
    if (config?.assistantName || config?.companyName || config?.ownerName) {
        prompt += `\n\nIDENTIDAD:`;
        if (config.assistantName) prompt += ` Nombre: ${config.assistantName}.`;
        if (config.companyName) prompt += ` Empresa: ${config.companyName}.`;
        if (config.ownerName) prompt += ` Jefe: ${config.ownerName}.`;
    }

    // Add business information if configured
    if (config?.businessNiche || config?.clientGoals || config?.offerDetails || config?.importantLinks?.length) {
        prompt += `\n\nNEGOCIO:`;
        if (config.businessNiche) prompt += ` Nicho: ${config.businessNiche}.`;
        if (config.clientGoals) prompt += ` Objetivos: ${config.clientGoals}.`;
        if (config.offerDetails) prompt += ` Oferta: ${config.offerDetails}.`;
        if (config.importantLinks && config.importantLinks.length > 0) {
            prompt += ` Links importantes: ${config.importantLinks.join(', ')}.`;
        }
    }

    // Add opening question if configured (for first contact)
    if (config?.openingQuestion) {
        prompt += `\n\nAPERTURA: Al iniciar una nueva conversación, usa esta pregunta: "${config.openingQuestion}"`;
    }

    // Add lead qualification settings if enabled
    if (config?.enableQualification === true) {
        prompt += `\n\nCALIFICACIÓN DE LEADS:`;
        if (config.qualifyingQuestion) {
            prompt += ` Pregunta clave: "${config.qualifyingQuestion}"`;
        }
        if (config.qualificationCriteria) {
            prompt += ` Criterios para calificar: ${config.qualificationCriteria}`;
        }
        if (config.disqualifyMessage) {
            prompt += ` Si el lead no califica, responde con: "${config.disqualifyMessage}"`;
        }
    }

    // Add tone guidelines if configured
    if (config?.toneGuidelines) {
        prompt += `\n\nESTILO: ${config.toneGuidelines}`;
    }

    // Add additional context if exists
    if (config?.additionalContext) {
        prompt += `\n\nCONTEXTO: ${config.additionalContext}`;
    }

    // Add conversation examples if they exist
    if (config?.conversationExamples) {
        prompt += `\n\nEJEMPLOS:\n${config.conversationExamples}`;
    }

    // Add knowledge bases content if available
    if (knowledgeBases && knowledgeBases.length > 0) {
        prompt += `\n\nBASE DE CONOCIMIENTO (usa esta información para responder):\n${knowledgeBases.join('\n\n')}`;
    }

    // Si hay contexto guardado del contacto, incluirlo
    if (contactContext) {
        prompt += `\n\n=== TU MEMORIA SOBRE ESTE LEAD ===
${contactContext}

IMPORTANTE: Esta es información que ya aprendiste sobre este lead en conversaciones anteriores. Úsala para personalizar tus respuestas. Si aprendes información nueva importante, usa la función update_context para actualizar tu memoria.`;
    } else {
        prompt += `\n\n=== MEMORIA ===
Es tu primera conversación con este lead o no tienes información guardada. Cuando aprendas datos importantes (nombre, qué busca, país, objeciones, etc.), usa la función update_context para guardarlos en tu memoria.`;
    }

    if (config?.enableMeetingScheduling === true) {
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

        const workDays = config?.meetingAvailableDays?.length > 0
            ? config.meetingAvailableDays.join(', ')
            : 'monday, tuesday, wednesday, thursday, friday';
        const duration = config?.meetingDuration || 30;

        prompt += `

=== CALENDARIO ===
Ahora: ${currentDateTime}
Mi zona horaria: ${timezone}
Horario laboral: ${config?.meetingAvailableHoursStart || '09:00'}-${config?.meetingAvailableHoursEnd || '18:00'} (en mi zona horaria)
Días laborales: ${workDays}
Duración de reuniones: ${duration} minutos

WORKFLOW DE AGENDAMIENTO (SIGUE ESTOS PASOS EN ORDEN):
1. Lead pregunta por reunión → PREGUNTA DE QUÉ PAÍS ES (ej: "¿Desde qué país me escribes? Así coordino bien el horario")
2. Lead dice su país → llama check_availability
3. check_availability devuelve eventos ocupados en MI zona horaria
4. CONVIERTE los horarios disponibles a la zona horaria del lead y proponlos
5. Lead confirma un horario → PIDE SU EMAIL (ej: "Perfecto! Para enviarte la invitación, ¿cuál es tu email?")
6. Lead da su email → llama schedule_meeting con fecha EN UTC, nombre Y email
7. Confirmas la reunión indicando la hora en AMBAS zonas horarias

IMPORTANTE SOBRE ZONAS HORARIAS:
- Mi horario laboral está en MI zona horaria (${timezone})
- SIEMPRE pregunta el país del lead ANTES de proponer horarios
- Cuando propongas horarios, indica la hora EN LA ZONA DEL LEAD
- Al confirmar, menciona "X:XX tu hora / Y:YY mi hora"
- Si la diferencia horaria hace imposible reunirse en horario laboral, explícalo amablemente

REGLAS GENERALES:
- NUNCA inventes eventos - usa SOLO lo que check_availability devuelve
- SIEMPRE pide el email ANTES de llamar schedule_meeting
- NO llames schedule_meeting sin tener el email del lead`;
    }

    return prompt;
}

function getBaseTools() {
    return [
        {
            type: 'function',
            function: {
                name: 'update_context',
                description: 'Actualiza tu memoria sobre este lead. Usa esta función para guardar información importante que aprendas durante la conversación: nombre real, qué busca, objeciones, horarios preferidos, país/zona horaria, presupuesto, urgencia, cualquier dato relevante.',
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
}

function getMeetingTools() {
    return [
        {
            type: 'function',
            function: {
                name: 'check_availability',
                description: 'Consulta eventos ocupados de los próximos 10 días. Devuelve config (work_hours, fecha actual) y occupied_events.',
                parameters: {
                    type: 'object',
                    properties: {
                        days_ahead: { type: 'number', description: 'Días a verificar (default 10)' }
                    }
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'schedule_meeting',
                description: 'Agenda reunión con link de Meet. SOLO llama cuando tengas email del lead.',
                parameters: {
                    type: 'object',
                    properties: {
                        meeting_date: { type: 'string', description: 'Fecha ISO 8601 UTC' },
                        duration_minutes: { type: 'number', description: 'Duración (default 30)' },
                        lead_name: { type: 'string', description: 'Nombre del lead' },
                        lead_email: { type: 'string', description: 'Email del lead' }
                    },
                    required: ['meeting_date', 'lead_name', 'lead_email']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'update_contact_email',
                description: 'Actualiza el email del contacto/lead en el CRM. Úsala cuando el lead te proporcione un email nuevo o corrija el anterior.',
                parameters: {
                    type: 'object',
                    properties: {
                        email: { type: 'string', description: 'El nuevo email del lead' }
                    },
                    required: ['email']
                }
            }
        }
    ];
}

async function executeCheckAvailability(userId: string, args: any) {
    try {
        const { data, error } = await supabase.functions.invoke('check-availability', {
            body: { user_id: userId, days_ahead: args.days_ahead || 10 }
        });
        if (error) return { error: 'No se pudo verificar disponibilidad', details: error };
        return data;
    } catch (error) {
        return { error: 'Error al verificar disponibilidad' };
    }
}

async function executeScheduleMeeting(userId: string, conversationId: string, agentId: string, args: any) {
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
        if (error) return { error: 'No se pudo agendar la reunión', details: error };
        return data;
    } catch (error) {
        return { error: 'Error al agendar la reunión' };
    }
}

async function executeUpdateContactEmail(userId: string, conversationId: string, args: any) {
    try {
        const { data, error } = await supabase.functions.invoke('update-contact-email', {
            body: {
                user_id: userId,
                conversation_id: conversationId,
                email: args.email
            }
        });
        if (error) return { error: 'No se pudo actualizar el email', details: error };
        return data;
    } catch (error) {
        return { error: 'Error al actualizar el email' };
    }
}

async function generateAIResponse(messages: any[], tools?: any[]) {
    if (!OPENAI_API_KEY) return null;

    try {
        const requestBody: any = {
            model: 'gpt-4o-mini',
            messages: messages,
            temperature: 0.7,
            max_tokens: 500
        };

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

        if (!response.ok) return null;

        const data = await response.json();
        return data.choices[0].message;
    } catch (error) {
        console.error('❌ Error generating AI response:', error);
        return null;
    }
}

async function sendWhatsAppMessage(userId: string, phoneNumberId: string, recipientPhone: string, message: string) {
    try {
        const { data: integration } = await supabase
            .from('integrations')
            .select('config')
            .eq('type', 'whatsapp')
            .eq('user_id', userId)
            .eq('status', 'connected')
            .single();

        const accessToken = integration?.config?.access_token;
        if (!accessToken) return null;

        const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: recipientPhone,
                type: 'text',
                text: { body: message }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (errorData.error?.code === 190) {
                await supabase.from('integrations').update({ status: 'disconnected' })
                    .eq('type', 'whatsapp').eq('user_id', userId);
            }
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('❌ Error sending WhatsApp message:', error);
        return null;
    }
}

async function saveOutboundMessage(conversationId: string, userId: string, content: string, agentId: string) {
    await supabase.from('messages').insert({
        conversation_id: conversationId,
        user_id: userId,
        platform_message_id: Date.now().toString(),
        content: content,
        direction: 'outbound',
        message_type: 'text',
        metadata: { generated_by: 'ai', agent_id: agentId, model: 'gpt-4o-mini' }
    });

    // Increment messages_used counter in subscription (only outbound/AI messages count)
    await supabase.rpc('increment_messages_used', { p_user_id: userId }).catch(() => {
        console.log('⚠️ Could not increment messages_used (user may not have subscription)');
    });
}

async function generateAndSendAutoReply(
    userId: string,
    conversationId: string,
    recipientPhone: string,
    inboundMessage: string,
    phoneNumberId: string
) {
    try {
        console.log('🤖 Generando respuesta automática con IA...');

        // 0. Check message limit before generating AI response
        const limitCheck = await checkMessageLimit(userId);
        if (!limitCheck.canSend) {
            console.log(`⚠️ Message limit reached, not generating AI response: ${limitCheck.reason}`);
            return;
        }

        const agent = await getWhatsAppAgent(userId);
        if (!agent) {
            console.log('⚠️ No se encontró agent de WhatsApp');
            return;
        }

        // Obtener historial (últimos 25 mensajes)
        const conversationHistory = await getConversationHistory(conversationId);

        // Obtener contexto del contacto (memoria de largo plazo)
        const contactContext = await getContactContext(conversationId);
        if (contactContext) {
            console.log('📝 Contexto del contacto cargado:', contactContext.substring(0, 100) + '...');
        }

        const systemPrompt = buildSystemPrompt(agent.name, agent.description, agent.config, contactContext);

        // Tools base (siempre incluye update_context)
        let tools: any[] = getBaseTools();

        // Agregar tools de calendario si está habilitado
        if (agent.config?.enableMeetingScheduling === true) {
            tools = [...tools, ...getMeetingTools()];
        }

        let messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: inboundMessage }
        ];

        // Tool execution loop (max 5 iterations)
        let iteration = 0;
        const maxIterations = 5;
        let finalResponse = null;

        while (iteration < maxIterations) {
            iteration++;
            console.log(`🔄 Iteración ${iteration}: Llamando a OpenAI...`);

            const aiMessage = await generateAIResponse(messages, tools);
            if (!aiMessage) {
                console.error('❌ No se pudo generar respuesta');
                return;
            }

            // If no tool calls, we have final response
            if (!aiMessage.tool_calls || aiMessage.tool_calls.length === 0) {
                finalResponse = aiMessage.content;
                break;
            }

            // Execute tool calls
            console.log(`🔧 Ejecutando ${aiMessage.tool_calls.length} tool calls`);
            messages.push(aiMessage);

            for (const toolCall of aiMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);

                console.log(`🔧 Ejecutando ${functionName}:`, functionArgs);

                let toolResult = null;

                if (functionName === 'check_availability') {
                    toolResult = await executeCheckAvailability(userId, functionArgs);
                } else if (functionName === 'schedule_meeting') {
                    toolResult = await executeScheduleMeeting(userId, conversationId, agent.id, functionArgs);
                } else if (functionName === 'update_contact_email') {
                    toolResult = await executeUpdateContactEmail(userId, conversationId, functionArgs);
                } else if (functionName === 'update_context') {
                    // Actualizar el contexto del contacto (memoria de largo plazo)
                    const success = await updateContactContext(conversationId, functionArgs.context);
                    toolResult = success
                        ? { success: true, message: 'Contexto actualizado correctamente' }
                        : { error: 'No se pudo actualizar el contexto' };
                } else {
                    toolResult = { error: 'Función desconocida' };
                }

                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(toolResult)
                });

                console.log(`✅ Resultado de ${functionName}:`, toolResult);
            }
        }

        // Send final response
        if (finalResponse) {
            const sendResult = await sendWhatsAppMessage(userId, phoneNumberId, recipientPhone, finalResponse);
            if (sendResult) {
                await saveOutboundMessage(conversationId, userId, finalResponse, agent.id);
                console.log('✅ Respuesta final enviada');
            }
        } else {
            console.warn('⚠️ No se obtuvo respuesta final');
        }

    } catch (error) {
        console.error('❌ Error en generateAndSendAutoReply:', error);
    }
}
