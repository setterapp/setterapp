import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const VERIFY_TOKEN = Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN') || 'whatsapp_verify_token_change_me';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';

// Crear cliente de Supabase con service role key para operaciones administrativas
const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log(`WhatsApp webhook function up and running!`);

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

      console.log('Webhook verification request:', { mode, token, challenge });
      console.log('Expected token:', VERIFY_TOKEN);

      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook verified successfully');
        return new Response(challenge, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      } else {
        console.error('❌ Webhook verification failed:', {
          mode,
          receivedToken: token,
          expectedToken: VERIFY_TOKEN,
          tokensMatch: token === VERIFY_TOKEN
        });
        return new Response('Verification failed', { status: 403 });
      }
    }

    // Recibir eventos del webhook (POST request)
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('📨 WhatsApp webhook event received:', JSON.stringify(body, null, 2));

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
    console.log('📩 Processing WhatsApp messaging event:', JSON.stringify(event, null, 2));

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
        console.error('❌ Could not find user_id for phoneNumberId:', phoneNumberId);
        return;
      }

      console.log('✅ Found user_id:', userId, 'for phoneNumberId:', phoneNumberId);

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
            contact: contactName,
            last_message_at: new Date(timestamp).toISOString(),
            unread_count: 1,
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

  prompt += `\n\nINSTRUCCIONES IMPORTANTES:\n`;
  prompt += `- Responde de manera natural, amigable y profesional.\n`;
  prompt += `- Mantén las conversaciones enfocadas y útiles.\n`;
  prompt += `- Sé conciso pero completo en tus respuestas.\n`;
  prompt += `- Si no sabes algo, admítelo honestamente.\n`;
  prompt += `- Siempre mantén el tono y estilo definido en las guías de tono.\n`;

  return prompt;
}

/**
 * Genera una respuesta usando OpenAI
 */
async function generateAIResponse(systemPrompt: string, conversationHistory: any[], userMessage: string) {
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

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ OpenAI API error:', errorData);
      return null;
    }

    const data = await response.json();
    return data.choices[0].message.content;
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
    console.log('✅ Mensaje enviado a WhatsApp:', data);
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

    // 4. Generar respuesta con IA
    const aiResponse = await generateAIResponse(systemPrompt, conversationHistory, inboundMessage);

    if (!aiResponse) {
      console.error('❌ No se pudo generar respuesta con IA');
      return;
    }

    console.log('✅ Respuesta generada:', aiResponse);

    // 5. Enviar respuesta a WhatsApp
    const sendResult = await sendWhatsAppMessage(userId, phoneNumberId, recipientPhone, aiResponse);

    if (!sendResult) {
      console.error('❌ No se pudo enviar mensaje a WhatsApp');
      return;
    }

    // 6. Guardar mensaje enviado en la BD
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        platform_message_id: sendResult.messages?.[0]?.id || Date.now().toString(),
        content: aiResponse,
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
