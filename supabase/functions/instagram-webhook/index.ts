import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const VERIFY_TOKEN = Deno.env.get('INSTAGRAM_WEBHOOK_VERIFY_TOKEN') || 'd368c7bd78882ba8aae97e480701363127efee4d7f2a2ed79c124fb123d088ec';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';

// Crear cliente de Supabase con service role key para operaciones administrativas
const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log(`Instagram webhook function up and running!`);

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
      console.log('📨 Instagram webhook event received:', JSON.stringify(body, null, 2));
      console.log('📨 Event object type:', body.object);
      console.log('📨 Event entries:', body.entry?.length || 0);

      // Instagram puede enviar eventos con object: 'instagram' o 'page'
      if (body.object === 'instagram' || body.object === 'page') {
        for (const entry of body.entry || []) {
          const pageId = entry.id;
          console.log('📨 Processing entry with pageId:', pageId);

          // Procesar eventos de mensajería (formato estándar)
          if (entry.messaging) {
            console.log('📨 Found messaging events:', entry.messaging.length);
            for (const event of entry.messaging) {
              await processInstagramEvent(event, pageId);
            }
          }

          // Procesar eventos en formato changes (alternativo)
          if (entry.changes) {
            console.log('📨 Found changes events:', entry.changes.length);
            for (const change of entry.changes) {
              // Si el change es de tipo messaging, procesarlo
              if (change.field === 'messages' && change.value) {
                console.log('📨 Processing messaging change:', change.value);
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
              await processInstagramEvent({ message }, pageId);
            }
          }
        }
      } else {
        console.warn('⚠️ Unknown event object type:', body.object);
        console.warn('⚠️ Full body:', JSON.stringify(body, null, 2));
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
 */
async function getInstagramUserProfile(userId: string, senderId: string): Promise<{ name?: string; username?: string; profile_picture?: string } | null> {
  try {
    // Obtener integración de Instagram para acceder al token
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('config')
      .eq('type', 'instagram')
      .eq('user_id', userId)
      .eq('status', 'connected')
      .single();

    if (error || !integration) {
      console.warn('⚠️ No se encontró integración de Instagram para obtener perfil');
      return null;
    }

    const accessToken = integration.config?.access_token;
    if (!accessToken) {
      console.warn('⚠️ No hay access token disponible para obtener perfil');
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
        .single();

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
          console.log('⚠️ Error en respuesta directa:', data.error);
          // Si el token ha expirado, no intentar más métodos
          if (data.error.code === 190 || data.error.code === '190') {
            console.warn('⚠️ Token expirado, no se puede obtener perfil');
            return null;
          }
        } else {
          console.log('✅ Perfil obtenido directamente:', data);
          return {
            name: data.name || null,
            username: data.username || null,
            profile_picture: data.profile_picture_url || null,
          };
        }
      } else {
        const errorText = await response.text();
        console.log('⚠️ Primer intento falló:', errorText);
        // Verificar si es error de token expirado
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error?.code === 190 || errorData.error?.code === '190') {
            console.warn('⚠️ Token expirado, no se puede obtener perfil');
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
          console.log('⚠️ Error en respuesta de Facebook:', data.error);
          // Si el token ha expirado, no intentar más métodos
          if (data.error.code === 190 || data.error.code === '190') {
            console.warn('⚠️ Token expirado, no se puede obtener perfil');
            return null;
          }
        } else {
          console.log('✅ Perfil obtenido desde Facebook:', data);
          return {
            name: data.name || null,
            username: data.username || null,
            profile_picture: data.profile_pic || null,
          };
        }
      } else {
        const errorText = await response.text();
        console.log('⚠️ Segundo intento falló:', errorText);
        // Verificar si es error de token expirado
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error?.code === 190 || errorData.error?.code === '190') {
            console.warn('⚠️ Token expirado, no se puede obtener perfil');
            return null;
          }
        } catch (e) {
          // No es JSON, continuar con otros métodos
        }
      }

      // Método 3: Intentar obtener información a través del endpoint de conversaciones
      // Buscar conversaciones que incluyan este senderId como participante
      const convResponse = await fetch(
        `https://graph.instagram.com/v21.0/${instagramBusinessAccountId}/conversations?fields=participants&access_token=${accessToken}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (convResponse.ok) {
        const convData = await convResponse.json();
        console.log('📋 Conversaciones obtenidas:', convData);

        // Buscar la conversación que contiene este senderId
        if (convData.data && convData.data.length > 0) {
          for (const conversation of convData.data) {
            if (conversation.participants?.data) {
              const participant = conversation.participants.data.find((p: any) => p.id === senderId);
              if (participant) {
                console.log('✅ Participante encontrado:', participant);
                // Intentar obtener el perfil completo del participante
                const participantResponse = await fetch(
                  `https://graph.instagram.com/v21.0/${participant.id}?fields=id,username,name,profile_picture_url&access_token=${accessToken}`,
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
                      profile_picture: participantData.profile_picture_url || participant.profile_pic || null,
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
        console.log('⚠️ Error obteniendo conversaciones:', errorText);
      }

      console.warn('⚠️ No se pudo obtener perfil de Instagram después de todos los intentos');
      return null;
    } catch (error) {
      console.warn('⚠️ Error al obtener perfil de Instagram:', error);
      return null;
    }
  } catch (error) {
    console.error('❌ Error getting Instagram user profile:', error);
    return null;
  }
}

/**
 * Obtiene el user_id asociado a una integración de Instagram
 * Intenta buscar por pageId primero, si no encuentra, usa la primera integración conectada
 */
async function getUserIdFromPageId(pageId: string): Promise<string | null> {
  try {
    // Primero intentar buscar todas las integraciones de Instagram conectadas
    const { data: integrations, error } = await supabase
      .from('integrations')
      .select('user_id, config')
      .eq('type', 'instagram')
      .eq('status', 'connected');

    if (error) {
      console.error('❌ Error finding integrations:', error);
      return null;
    }

    if (!integrations || integrations.length === 0) {
      console.error('❌ No connected Instagram integrations found');
      return null;
    }

    // Si hay pageId, intentar encontrar una que coincida
    if (pageId) {
      for (const integration of integrations) {
        const config = integration.config || {};
        const instagramPageId = config.instagram_page_id || config.page_id;

        if (instagramPageId === pageId) {
          console.log('✅ Found integration matching pageId:', pageId);
          return integration.user_id;
        }
      }
    }

    // Si no hay pageId o no coincide, usar la primera integración conectada
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
    console.log('📩 Processing Instagram messaging event:', JSON.stringify(event, null, 2));

    // Solo procesar mensajes entrantes (inbound)
    if (event.message && !event.message.is_echo) {
      const message = event.message;
      const senderId = event.sender?.id;
      const recipientId = event.recipient?.id;
      // Instagram puede enviar timestamp en milisegundos o segundos
      // Si es mayor que 1e12, está en milisegundos
      const rawTimestamp = event.timestamp;

      // Determinar si está en milisegundos o segundos
      // Los timestamps en milisegundos son típicamente > 1e12 (año 2001)
      // Los timestamps en segundos son típicamente < 1e10 (año 2286)
      let timestampInMs: number;
      let timestampInSeconds: number;

      if (rawTimestamp > 1e12) {
        // Está en milisegundos
        timestampInMs = rawTimestamp;
        timestampInSeconds = Math.floor(rawTimestamp / 1000);
      } else {
        // Está en segundos
        timestampInSeconds = rawTimestamp;
        timestampInMs = rawTimestamp * 1000;
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
          dateFromTimestamp: dateFromTimestamp.toISOString(),
          year,
          isValidDate
        });
        // Usar timestamp actual como fallback
        timestampInMs = Date.now();
        timestampInSeconds = Math.floor(Date.now() / 1000);
        console.log('⚠️ Using current timestamp as fallback:', {
          timestampInMs,
          timestampInSeconds,
          date: new Date(timestampInMs).toISOString()
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

      console.log('📩 Message details:', {
        senderId,
        recipientId,
        rawTimestamp,
        timestampInSeconds,
        timestampInMs,
        dateFromTimestamp: new Date(timestampInMs).toISOString(),
        messageId,
        messageText,
        pageId
      });

      // Obtener user_id de la integración
      const userId = await getUserIdFromPageId(pageId);
      if (!userId) {
        console.error('❌ Could not find user_id for pageId:', pageId);
        return;
      }

      console.log('✅ Found user_id:', userId, 'for pageId:', pageId);

      // Obtener perfil del usuario de Instagram (nombre, username, foto)
      console.log('📸 Obteniendo perfil de Instagram para:', senderId);
      const userProfile = await getInstagramUserProfile(userId, senderId);
      if (userProfile) {
        console.log('✅ Perfil obtenido:', userProfile);
      } else {
        console.log('⚠️ No se pudo obtener perfil, se usará senderId como nombre');
      }

      // Determinar el nombre a mostrar (username > name > senderId)
      const displayName = userProfile?.username || userProfile?.name || senderId;
      const contactName = userProfile?.name || userProfile?.username || senderId;

      // Buscar o crear conversación
      let conversationId: string | null = null;

      // Buscar conversación existente
      const { data: existingConv, error: findError } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', userId)
        .eq('platform', 'instagram')
        .eq('platform_conversation_id', senderId)
        .single();

      if (findError && findError.code !== 'PGRST116') {
        console.error('❌ Error finding conversation:', findError);
      }

      if (existingConv) {
        conversationId = existingConv.id;
        console.log('✅ Found existing conversation:', conversationId);

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

        // Actualizar el nombre si tenemos información del perfil y el contacto actual es solo un ID
        if (userProfile && (currentConv?.contact === senderId || !currentConv?.contact || currentConv?.contact.match(/^\d+$/))) {
          updateData.contact = displayName;
          updateData.contact_metadata = {
            username: userProfile.username,
            name: userProfile.name,
            profile_picture: userProfile.profile_picture,
          };
          console.log('📝 Actualizando nombre de contacto y metadata:', displayName, userProfile);
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
            contact: displayName, // Usar username o name si está disponible
            last_message_at: lastMessageDateISO,
            unread_count: 1,
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
          userId,
          messageId,
          messageText,
          senderId
        });

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
              raw_timestamp: rawTimestamp,
            },
          })
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
    console.log('🔄 Processing Instagram change:', change);
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
    console.log('✅ Mensaje enviado a Instagram:', data);
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

    // 4. Generar respuesta con IA
    const aiResponse = await generateAIResponse(systemPrompt, conversationHistory, inboundMessage);

    if (!aiResponse) {
      console.error('❌ No se pudo generar respuesta con IA');
      return;
    }

    console.log('✅ Respuesta generada:', aiResponse);

    // 5. Enviar respuesta a Instagram
    const sendResult = await sendInstagramMessage(userId, recipientId, aiResponse);

    if (!sendResult) {
      console.error('❌ No se pudo enviar mensaje a Instagram');
      return;
    }

    // 6. Guardar mensaje enviado en la BD
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        platform_message_id: sendResult.message_id || sendResult.id,
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
