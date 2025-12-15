import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const VERIFY_TOKEN = Deno.env.get('INSTAGRAM_WEBHOOK_VERIFY_TOKEN') || 'd368c7bd78882ba8aae97e480701363127efee4d7f2a2ed79c124fb123d088ec';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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

      if (body.object === 'instagram') {
        for (const entry of body.entry || []) {
          const pageId = entry.id;

          // Procesar eventos de mensajería
          if (entry.messaging) {
            for (const event of entry.messaging) {
              await processInstagramEvent(event, pageId);
            }
          }

          // Procesar otros tipos de eventos si los hay
          if (entry.changes) {
            for (const change of entry.changes) {
              await processInstagramChange(change, pageId);
            }
          }
        }
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
 * Obtiene el user_id asociado a una integración de Instagram por pageId
 */
async function getUserIdFromPageId(pageId: string): Promise<string | null> {
  try {
    // Buscar la integración de Instagram que tenga este pageId en su config
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('user_id, config')
      .eq('type', 'instagram')
      .eq('status', 'connected')
      .single();

    if (error || !integration) {
      console.error('❌ Error finding integration for pageId:', pageId, error);
      return null;
    }

    // Verificar si el pageId coincide (puede estar en config.instagram_page_id o config.page_id)
    const config = integration.config || {};
    const instagramPageId = config.instagram_page_id || config.page_id;

    if (instagramPageId === pageId || !instagramPageId) {
      // Si no hay pageId específico, usar la primera integración conectada
      return integration.user_id;
    }

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
    console.log('📩 Processing Instagram messaging event:', JSON.stringify(event, null, 2));

    // Solo procesar mensajes entrantes (inbound)
    if (event.message && !event.message.is_echo) {
      const message = event.message;
      const senderId = event.sender?.id;
      const recipientId = event.recipient?.id;
      const timestamp = event.timestamp;
      const messageId = message.mid || message.id;
      const messageText = message.text || '';

      // Obtener user_id de la integración
      const userId = await getUserIdFromPageId(pageId);
      if (!userId) {
        console.error('❌ Could not find user_id for pageId:', pageId);
        return;
      }

      console.log('✅ Found user_id:', userId, 'for pageId:', pageId);

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
        // Primero obtener el unread_count actual
        const { data: currentConv } = await supabase
          .from('conversations')
          .select('unread_count')
          .eq('id', conversationId)
          .single();

        await supabase
          .from('conversations')
          .update({
            last_message_at: new Date(timestamp * 1000).toISOString(),
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
            platform: 'instagram',
            platform_conversation_id: senderId,
            platform_page_id: pageId,
            contact: senderId, // Usar senderId como nombre temporal, se puede actualizar después
            last_message_at: new Date(timestamp * 1000).toISOString(),
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
              recipient_id: recipientId,
              timestamp: timestamp,
            },
          });

        if (messageError) {
          console.error('❌ Error saving message:', messageError);
        } else {
          console.log('✅ Message saved successfully');
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
