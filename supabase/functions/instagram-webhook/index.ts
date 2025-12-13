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
          // Procesar eventos de mensajería
          if (entry.messaging) {
            for (const event of entry.messaging) {
              await processInstagramEvent(event, entry.id);
            }
          }

          // Procesar otros tipos de eventos si los hay
          if (entry.changes) {
            for (const change of entry.changes) {
              await processInstagramChange(change, entry.id);
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
 * Procesa eventos de mensajería de Instagram
 */
async function processInstagramEvent(event: any, pageId: string) {
  try {
    console.log('📩 Processing Instagram messaging event:', event);

    // Ejemplo: evento de mensaje recibido
    if (event.message) {
      const message = event.message;
      const senderId = event.sender?.id;
      const recipientId = event.recipient?.id;
      const timestamp = event.timestamp;

      // Aquí puedes guardar el mensaje en tu base de datos
      const { error } = await supabase.from('conversations').insert({
        platform: 'instagram',
        platform_conversation_id: senderId,
        platform_page_id: pageId,
        last_message_at: new Date(timestamp * 1000).toISOString(),
      });

      if (error) {
        console.error('Error saving conversation:', error);
      } else {
        console.log('✅ Conversation saved successfully');
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
    console.error('Error processing Instagram event:', error);
  }
}

/**
 * Procesa cambios en Instagram (publicaciones, comentarios, etc.)
 */
async function processInstagramChange(change: any, pageId: string) {
  try {
    console.log('🔄 Processing Instagram change:', change);
    // Implementa la lógica para procesar cambios
  } catch (error) {
    console.error('Error processing Instagram change:', error);
  }
}
