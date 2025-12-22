import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const VERIFY_TOKEN = Deno.env.get('MESSENGER_WEBHOOK_VERIFY_TOKEN') || 'messenger_verify_token_change_me';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log(`Messenger webhook function up and running!`);

Deno.serve(async (req: Request) => {
  // CORS
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
        return new Response(challenge, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      return new Response('Verification failed', { status: 403 });
    }

    // Webhook events (POST)
    if (req.method === 'POST') {
      const body = await req.json().catch(() => null);
      if (!body) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Messenger webhooks use object: 'page'
      if (body.object === 'page') {
        for (const entry of body.entry || []) {
          const pageId = String(entry.id || '');
          const events = Array.isArray(entry.messaging) ? entry.messaging : [];
          for (const event of events) {
            await processMessengerEvent(event, pageId);
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
    console.error('❌ Error processing Messenger webhook:', error);
    return new Response(JSON.stringify({ error: (error as any)?.message || 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

async function getUserIdFromPageId(pageId: string): Promise<string | null> {
  try {
    const { data: integrations, error } = await supabase
      .from('integrations')
      .select('user_id, config')
      .eq('type', 'messenger')
      .eq('status', 'connected');

    if (error || !integrations || integrations.length === 0) return null;

    if (pageId) {
      for (const integration of integrations) {
        const config = integration.config || {};
        const cfgPageId = config.page_id || config.pageId;
        if (cfgPageId === pageId) return integration.user_id;
      }
    }

    return integrations[0].user_id;
  } catch {
    return null;
  }
}

async function getMessengerUserProfile(params: {
  userId: string;
  senderId: string;
}): Promise<{ name?: string | null; first_name?: string | null; last_name?: string | null; profile_picture?: string | null } | null> {
  const { userId, senderId } = params;
  try {
    const { data: integration } = await supabase
      .from('integrations')
      .select('config')
      .eq('type', 'messenger')
      .eq('user_id', userId)
      .eq('status', 'connected')
      .single();

    const pageAccessToken = integration?.config?.page_access_token;
    if (!pageAccessToken) return null;

    const res = await fetch(
      `https://graph.facebook.com/v24.0/${encodeURIComponent(senderId)}?fields=first_name,last_name,name,profile_pic&access_token=${encodeURIComponent(pageAccessToken)}`,
      { method: 'GET' }
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.error) return null;

    return {
      name: data.name ?? null,
      first_name: data.first_name ?? null,
      last_name: data.last_name ?? null,
      profile_picture: data.profile_pic ?? null,
    };
  } catch {
    return null;
  }
}

async function processMessengerEvent(event: any, pageId: string) {
  try {
    // Only inbound user messages
    if (!event?.message || event?.message?.is_echo) return;

    const senderId = String(event.sender?.id || '');
    const recipientId = String(event.recipient?.id || '');
    if (!senderId) return;

    const rawTimestamp = event.timestamp;
    const timestampInMs = typeof rawTimestamp === 'number' && rawTimestamp > 0 ? rawTimestamp : Date.now();
    const timestampInSeconds = Math.floor(timestampInMs / 1000);
    const messageId = event.message?.mid || event.message?.id || `${Date.now()}`;
    const messageText = String(event.message?.text || '');

    const userId = await getUserIdFromPageId(pageId);
    if (!userId) return;

    // Debug opt-in
    try {
      const { data: dbgIntegration } = await supabase
        .from('integrations')
        .select('config')
        .eq('type', 'messenger')
        .eq('user_id', userId)
        .eq('status', 'connected')
        .single();
      const debugEnabled = Boolean(dbgIntegration?.config?.debug_webhooks);
      if (debugEnabled) {
        await supabase
          .from('webhook_debug_events')
          .insert({
            user_id: userId,
            platform: 'messenger',
            payload: { pageId, event },
          });
      }
    } catch {
      // ignore
    }

    const profile = await getMessengerUserProfile({ userId, senderId });
    const displayName = profile?.name || senderId;

    // Upsert contact
    let contactId: string | null = null;
    try {
      const { data: upsertedContact } = await supabase
        .from('contacts')
        .upsert(
          {
            user_id: userId,
            platform: 'messenger',
            external_id: senderId,
            display_name: displayName,
            profile_picture: profile?.profile_picture || null,
            last_message_at: new Date(timestampInMs).toISOString(),
            metadata: profile ? {
              name: profile.name,
              first_name: profile.first_name,
              last_name: profile.last_name,
              profile_picture: profile.profile_picture,
            } : {},
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,platform,external_id' }
        )
        .select('id')
        .single();

      contactId = upsertedContact?.id || null;
    } catch {
      // ignore
    }

    // Find or create conversation
    let conversationId: string | null = null;
    const { data: existingConv, error: findError } = await supabase
      .from('conversations')
      .select('id, unread_count')
      .eq('user_id', userId)
      .eq('platform', 'messenger')
      .eq('platform_conversation_id', senderId)
      .single();

    if (findError && findError.code !== 'PGRST116') {
      // ignore
    }

    if (existingConv?.id) {
      conversationId = existingConv.id;
      await supabase
        .from('conversations')
        .update({
          contact: displayName,
          contact_id: contactId,
          platform_page_id: pageId || recipientId || null,
          contact_metadata: profile ? {
            name: profile.name,
            profile_picture: profile.profile_picture,
          } : {},
          last_message_at: new Date(timestampInMs).toISOString(),
          unread_count: (existingConv.unread_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId);
    } else {
      const { data: newConv, error: createError } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          platform: 'messenger',
          platform_conversation_id: senderId,
          platform_page_id: pageId || recipientId || null,
          contact_id: contactId,
          contact: displayName,
          last_message_at: new Date(timestampInMs).toISOString(),
          unread_count: 1,
          contact_metadata: profile ? {
            name: profile.name,
            profile_picture: profile.profile_picture,
          } : {},
        })
        .select('id')
        .single();

      if (createError) return;
      conversationId = newConv.id;
    }

    // Save message
    if (conversationId && messageText) {
      await supabase
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
            page_id: pageId,
          },
        });
    }
  } catch (error) {
    console.error('❌ Error processing Messenger event:', error);
  }
}
