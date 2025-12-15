import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const VERIFY_TOKEN = Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN') || 'whatsapp_verify_token_change_me';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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
    // Buscar la integración de WhatsApp que tenga este phoneNumberId en su config
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('user_id, config')
      .eq('type', 'whatsapp')
      .eq('status', 'connected')
      .single();

    if (error || !integration) {
      console.error('❌ Error finding WhatsApp integration for phoneNumberId:', phoneNumberId, error);
      return null;
    }

    // Verificar si el phoneNumberId coincide (puede estar en config.phoneNumberId)
    const config = integration.config || {};
    const configPhoneNumberId = config.phoneNumberId;
    
    if (configPhoneNumberId === phoneNumberId || !configPhoneNumberId) {
      // Si no hay phoneNumberId específico, usar la primera integración conectada
      return integration.user_id;
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

