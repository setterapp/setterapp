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

// Crear cliente de Supabase con service role key para operaciones administrativas
const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log(`WhatsApp webhook function initialized`);

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

            console.log('Webhook verification request received');

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
            console.log('📨 WhatsApp webhook event received');

            if (body.object === 'whatsapp_business_account') {
                for (const entry of body.entry || []) {
                    const phoneNumberId = entry.id;

                    // Procesar eventos de mensajería
                    if (entry.changes) {
                        for (const change of entry.changes) {
                            if (change.value?.messages) {
                                for (const event of change.value.messages) {
                                    await processWhatsAppEvent(event, change.value, phoneNumberId);
                                }
                            }

                            // Procesar status updates (delivered, read, etc.)
                            if (change.value?.statuses) {
                                for (const status of change.value.statuses) {
                                    await processWhatsAppStatus(status);
                                }
                            }
                        }
                    }
                }
            }

            // Responder 200 OK a WhatsApp para confirmar recepción
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
 * Obtiene el user_id asociado a una integración de WhatsApp por phoneNumberId
 */
async function getUserIdFromPhoneNumberId(phoneNumberId: string): Promise<string | null> {
    try {
        // Primero intentar buscar por phoneNumberId específico en config
        const { data: integrations, error } = await supabase
            .from('integrations')
            .select('user_id, config')
            .eq('type', 'whatsapp')
            .eq('status', 'connected');

        if (error) {
            console.error('❌ Error finding WhatsApp integrations:', error);
            return null;
        }

        if (!integrations || integrations.length === 0) {
            console.error('❌ No WhatsApp integrations found');
            return null;
        }

        // Buscar la integración que coincida con el phoneNumberId
        for (const integration of integrations) {
            const config = integration.config || {};
            const configPhoneNumberId = config.phoneNumberId;

            // Si el phoneNumberId coincide exactamente, usar esta integración
            if (configPhoneNumberId === phoneNumberId) {
                console.log('✅ Found matching integration for phoneNumberId:', phoneNumberId);
                return integration.user_id;
            }
        }

        // Si no hay coincidencia exacta pero hay integraciones, usar la primera
        // (útil para casos donde el phoneNumberId no está guardado aún)
        if (integrations.length > 0) {
            console.log('⚠️ No exact match found, using first connected integration');
            return integrations[0].user_id;
        }

        return null;
    } catch (error) {
        console.error('❌ Error getting user_id from phoneNumberId:', error);
        return null;
    }
}

/**
 * Procesa eventos de mensajería de WhatsApp
 */
async function processWhatsAppEvent(event: any, value: any, phoneNumberId: string) {
    try {
        console.log('📩 Processing WhatsApp messaging event');

        // Solo procesar mensajes entrantes (no outbound)
        if (event.from && event.type === 'text') {
            const senderId = event.from;
            const messageId = event.id;
            const messageText = event.text?.body || '';
            const timestamp = parseInt(event.timestamp) * 1000; // WhatsApp timestamp está en segundos
            const contactName = value.contacts?.[0]?.profile?.name || senderId;

            // Obtener user_id de la integración
            const userId = await getUserIdFromPhoneNumberId(phoneNumberId);
            if (!userId) {
                console.error('❌ Could not find user_id for phoneNumberId');
                return;
            }

            console.log('✅ User integration found');

            // Upsert contacto (CRM) y obtener contact_id
            let contactId: string | null = null;
            try {
                const { data: upsertedContact } = await supabase
                    .from('contacts')
                    .upsert(
                        {
                            user_id: userId,
                            platform: 'whatsapp',
                            external_id: senderId,
                            display_name: contactName,
                            phone: senderId,
                            last_message_at: new Date(timestamp).toISOString(),
                            lead_status: 'cold', // Estado inicial para nuevos contactos
                            metadata: { name: contactName },
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
                .eq('platform', 'whatsapp')
                .eq('platform_conversation_id', senderId)
                .single();

            if (findError && findError.code !== 'PGRST116') {
                console.error('❌ Error finding conversation:', findError);
            }

            if (existingConv) {
                conversationId = existingConv.id;
                console.log('✅ Found existing conversation:', conversationId);

                // Actualizar last_message_at, unread_count y contact name si cambió
                // Primero obtener el unread_count actual
                const { data: currentConv } = await supabase
                    .from('conversations')
                    .select('unread_count')
                    .eq('id', conversationId)
                    .single();

                await supabase
                    .from('conversations')
                    .update({
                        contact: contactName,
                        contact_id: contactId,
                        contact_metadata: {
                            name: contactName,
                        },
                        last_message_at: new Date(timestamp).toISOString(),
                        unread_count: (currentConv?.unread_count || 0) + 1,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', conversationId);
            } else {
                // Crear nueva conversación
                const { data: newConv, error: createError } = await supabase
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
                        lead_status: 'cold', // Estado inicial para nuevos leads
                        contact_metadata: {
                            name: contactName,
                        },
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
                const { error: messageError } = await supabase
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
                            phone_number_id: phoneNumberId,
                            timestamp: event.timestamp,
                        },
                    });

                if (messageError) {
                    console.error('❌ Error saving message:', messageError);
                } else {
                    console.log('✅ Message saved successfully');

                    // 🤖 Generar y enviar respuesta automática con IA
                    // Esta función se ejecuta de forma asíncrona sin bloquear la respuesta del webhook
                    generateAndSendAutoReply(userId, conversationId, senderId, messageText, phoneNumberId)
                        .catch(error => {
                            console.error('❌ Error en respuesta automática:', error);
                            // No lanzar el error para no afectar el webhook
                        });

                    // Clasificación automática de lead status removida - ahora es manual por el usuario
                }
            }

            // Manejar otros tipos de mensajes (imágenes, etc.)
            if (event.type !== 'text') {
                console.log('📎 Message type:', event.type, event);
                // TODO: Guardar información de otros tipos de mensajes en metadata
            }
        }
    } catch (error) {
        console.error('❌ Error processing WhatsApp event:', error);
    }
}

/**
 * Procesa actualizaciones de estado de mensajes (delivered, read, etc.)
 */
async function processWhatsAppStatus(status: any) {
    try {
        console.log('📬 WhatsApp status update:', status);
        // TODO: Actualizar estado de mensajes en la base de datos si es necesario
    } catch (error) {
        console.error('Error processing WhatsApp status:', error);
    }
}

/**
 * Obtiene el agent de WhatsApp asignado al usuario
 */
async function getWhatsAppAgent(userId: string) {
    try {
        const { data: agent, error } = await supabase
            .from('agents')
            .select('*')
            .eq('user_id', userId)
            .eq('platform', 'whatsapp')
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

    prompt += `\n\n=== INFORMACIÓN ACTUAL ===\n`;
    prompt += `Fecha y hora actual: ${currentDateTime}\n`;
    prompt += `Zona horaria: ${timezone}\n\n`;

    // Instrucciones específicas para agendamiento de reuniones
    if (config?.enableMeetingScheduling) {
        prompt += `=== AGENDAMIENTO DE REUNIONES ===\n`;
        prompt += `Tienes la capacidad de agendar reuniones automáticamente en Google Calendar usando la función schedule_meeting.\n\n`;

        prompt += `🔧 CRÍTICO - REGLAS ABSOLUTAS PARA AGENDAR:\n`;
        prompt += `1. NUNCA llames a schedule_meeting sin tener el EMAIL del lead\n`;
        prompt += `2. El email debe ser proporcionado EXPLÍCITAMENTE por el lead en la conversación\n`;
        prompt += `3. NUNCA inventes, generes o asumas un email - es FRAUDE hacerlo\n`;
        prompt += `4. NO digas "te agendo" o "ya agendé" hasta que hayas llamado a la función Y recibas confirmación\n`;
        prompt += `5. La función schedule_meeting creará el evento real en Google Calendar y generará el link de Google Meet\n\n`;

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
        prompt += `   - Horario de atención: ${config.meetingAvailableHoursStart || '9:00'} a ${config.meetingAvailableHoursEnd || '18:00'}\n`;
        prompt += `   - Duración de la reunión: ${config.meetingDuration || 30} minutos\n`;
        prompt += `   - Ejemplo: "¿Qué día y hora te viene mejor?"\n`;
        prompt += `   - Ejemplo: "¿Prefieres mañana por la mañana o tarde?"\n`;
        prompt += `   - IMPORTANTE: Cuando calcules la fecha/hora en ISO 8601, usa la fecha actual de arriba (${currentDateTime}) como referencia\n`;
        prompt += `   - Si el lead dice "mañana a las 3pm", calcula correctamente basándote en la fecha actual\n\n`;

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
            description: 'SOLO usa esta función DESPUÉS de que el lead te haya dado su email explícitamente. NUNCA inventes o asumas un email. Si no tienes el email del lead, NO llames a esta función.',
            parameters: {
                type: 'object',
                properties: {
                    lead_email: {
                        type: 'string',
                        description: 'Email del lead que TE DIO EXPLÍCITAMENTE en la conversación. NUNCA inventes, generes o asumas un email. Debe ser EXACTAMENTE el email que el lead escribió.'
                    },
                    lead_name: {
                        type: 'string',
                        description: 'Nombre completo del lead tal como te lo dio en la conversación'
                    },
                    preferred_datetime: {
                        type: 'string',
                        description: 'Fecha y hora preferida para la reunión en formato ISO 8601. Si el lead dice "mañana a las 3pm", calcular la fecha exacta basándose en la fecha/hora actual y convertir a formato ISO. IMPORTANTE: Asegúrate de calcular la fecha correctamente respetando la zona horaria.'
                    },
                    lead_phone: {
                        type: 'string',
                        description: 'Número de teléfono del lead (opcional)'
                    }
                },
                required: ['lead_email', 'lead_name', 'preferred_datetime']
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
 * Envía un mensaje a WhatsApp
 */
async function sendWhatsAppMessage(userId: string, phoneNumberId: string, recipientPhone: string, message: string) {
    try {
        // Obtener integración de WhatsApp del usuario
        const { data: integration, error } = await supabase
            .from('integrations')
            .select('config')
            .eq('type', 'whatsapp')
            .eq('user_id', userId)
            .eq('status', 'connected')
            .single();

        if (error || !integration) {
            console.error('❌ No se encontró integración de WhatsApp:', error);
            return null;
        }

        const accessToken = integration?.config?.access_token;

        if (!accessToken) {
            console.error('❌ Falta access token de WhatsApp');
            return null;
        }

        // Enviar mensaje usando WhatsApp Cloud API
        const response = await fetch(
            `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
            {
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
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Error enviando mensaje a WhatsApp:', errorData);

            // Si el token ha expirado, marcar la integración como desconectada
            if (errorData.error?.code === 190 || errorData.error?.code === '190') {
                console.warn('⚠️ Token de WhatsApp expirado, marcando integración como desconectada');
                await supabase
                    .from('integrations')
                    .update({ status: 'disconnected' })
                    .eq('type', 'whatsapp')
                    .eq('user_id', userId);
            }

            return null;
        }

        const data = await response.json();
        console.log('✅ Message sent to WhatsApp successfully');
        return data;
    } catch (error) {
        console.error('❌ Error sending WhatsApp message:', error);
        return null;
    }
}

/**
 * Genera y envía una respuesta automática con IA
 */
async function generateAndSendAutoReply(
    userId: string,
    conversationId: string,
    recipientPhone: string,
    inboundMessage: string,
    phoneNumberId: string
) {
    try {
        console.log('🤖 Generando respuesta automática con IA...');

        // 1. Obtener el agent de WhatsApp del usuario
        const agent = await getWhatsAppAgent(userId);
        if (!agent) {
            console.log('⚠️ No se encontró agent de WhatsApp, no se enviará respuesta automática');
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
            console.log('📅 El modelo quiere agendar una reunión');
            console.log('📋 Tool calls:', JSON.stringify(aiMessage.tool_calls, null, 2));

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

                    console.log('📅 [AutoReply] Meeting creation result:', JSON.stringify(meetingResult, null, 2));

                    if (meetingResult.success) {
                        // Verificar que el link sea de Google Meet y no del calendario
                        const meetLink = meetingResult.meeting.link;
                        const isGoogleMeetLink = meetLink && (meetLink.includes('meet.google.com') || meetLink.includes('hangouts.google.com'));

                        // Enviar mensaje de confirmación con el link de la reunión
                        let confirmationMessage = `perfecto ${args.lead_name}! te agendé la reunión para el ${formatMeetingDate(meetingResult.meeting.date)}. `;

                        if (isGoogleMeetLink) {
                            confirmationMessage += `te llegará la invitación a ${args.lead_email} con el link de google meet: ${meetLink}`;
                        } else {
                            confirmationMessage += `te llegará la invitación a ${args.lead_email} con toda la información de la reunión.`;
                            console.warn('⚠️ El link no es de Google Meet:', meetLink);
                        }

                        await sendWhatsAppMessage(userId, phoneNumberId, recipientPhone, confirmationMessage);

                        // Guardar mensaje de confirmación
                        await supabase
                            .from('messages')
                            .insert({
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
                            });

                        console.log('✅ Reunión agendada y confirmación enviada');
                    } else {
                        // Si falló la creación, enviar mensaje explicando el problema
                        console.error('❌ [AutoReply] Failed to create meeting:', {
                            error: meetingResult.error,
                            leadEmail: args.lead_email,
                            leadName: args.lead_name,
                            preferredDatetime: args.preferred_datetime,
                            conversationId,
                            userId
                        });
                        const errorMessage = 'disculpa, hubo un problema agendando la reunión. déjame verificar y te confirmo en un momento.';
                        await sendWhatsAppMessage(userId, phoneNumberId, recipientPhone, errorMessage);
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

        // 7. Enviar respuesta a WhatsApp
        const sendResult = await sendWhatsAppMessage(userId, phoneNumberId, recipientPhone, textContent);

        if (!sendResult) {
            console.error('❌ No se pudo enviar mensaje a WhatsApp');
            return;
        }

        // 8. Guardar mensaje enviado en la BD
        const { error: messageError } = await supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                user_id: userId,
                platform_message_id: sendResult.messages?.[0]?.id || Date.now().toString(),
                content: textContent,
                direction: 'outbound',
                message_type: 'text',
                metadata: {
                    generated_by: 'ai',
                    agent_id: agent.id,
                    model: 'gpt-4o-mini'
                },
            });

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
 * Crea una reunión para el lead usando la Edge Function schedule-meeting
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
        console.log('📅 [CreateMeetingForLead] Invoking schedule-meeting function with:', {
            conversationId,
            leadName,
            leadEmail,
            leadPhone,
            agentId: agent.id,
            customDate: preferredDatetime,
            agentName: agent.name,
            meetingEnabled: agent.config?.enableMeetingScheduling
        });

        const { data, error } = await supabase.functions.invoke('schedule-meeting', {
            body: {
                user_id: userId,
                conversation_id: conversationId,
                agent_id: agent.id,
                meeting_date: preferredDatetime,
                lead_name: leadName,
                lead_email: leadEmail
            }
        });

        if (error) {
            console.error('❌ [CreateMeetingForLead] Error creando reunión:', {
                error: JSON.stringify(error),
                message: error.message,
                context: error.context
            });
            return { success: false, error: error.message || JSON.stringify(error) };
        }

        console.log('✅ [CreateMeetingForLead] Meeting created successfully:', {
            meetingId: data?.meeting?.id,
            date: data?.meeting?.date,
            link: data?.meeting?.link
        });

        return data;
    } catch (error) {
        console.error('❌ [CreateMeetingForLead] Exception calling schedule-meeting:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        return { success: false, error: error.message };
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

// Función de detección automática de lead status removida - ahora es manual por el usuario
// La clasificación de leads se hace manualmente desde la UI mediante un selector dropdown
