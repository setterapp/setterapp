import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

type ResolveBody = {
  conversationId?: string;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // Supabase client envía headers extra (p.ej. x-client-info / apikey) -> deben estar permitidos en preflight
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

async function getAuthedUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null;

  // Verificamos el JWT usando el cliente anon (Auth API)
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await supabaseAuth.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

async function getInstagramUserProfile(params: {
  accessToken: string;
  instagramBusinessAccountId: string;
  senderId: string;
}): Promise<{ name?: string | null; username?: string | null; profile_picture?: string | null } | null> {
  const { accessToken, instagramBusinessAccountId, senderId } = params;

  // Método 1 (rápido): intentar directo por senderId en Facebook Graph
  try {
    const direct = await fetch(
      `https://graph.facebook.com/v21.0/${senderId}?fields=id,username,name,profile_pic&access_token=${accessToken}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );
    if (direct.ok) {
      const data = await direct.json();
      if (!data?.error) {
        return {
          name: data.name ?? null,
          username: data.username ?? null,
          profile_picture: data.profile_pic ?? null,
        };
      }
      if (data?.error?.code === 190 || data?.error?.code === '190') return null;
    } else {
      const text = await direct.text();
      try {
        const parsed = JSON.parse(text);
        if (parsed?.error?.code === 190 || parsed?.error?.code === '190') return null;
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore y probar método 2
  }

  // Método 2: listar conversaciones y buscar participantes
  try {
    const conv = await fetch(
      `https://graph.facebook.com/v21.0/${instagramBusinessAccountId}/conversations?fields=participants&access_token=${accessToken}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );
    if (!conv.ok) return null;
    const convData = await conv.json();
    const items: any[] = Array.isArray(convData?.data) ? convData.data : [];
    for (const c of items) {
      const participants: any[] = Array.isArray(c?.participants?.data) ? c.participants.data : [];
      const participant = participants.find((p: any) => p?.id === senderId);
      if (!participant) continue;

      // Intentar completar datos del participante
      try {
        const pRes = await fetch(
          `https://graph.facebook.com/v21.0/${participant.id}?fields=id,username,name,profile_pic&access_token=${accessToken}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        if (pRes.ok) {
          const pData = await pRes.json();
          if (!pData?.error) {
            return {
              name: pData.name ?? participant.name ?? null,
              username: pData.username ?? participant.username ?? null,
              profile_picture: pData.profile_pic ?? participant.profile_pic ?? null,
            };
          }
          if (pData?.error?.code === 190 || pData?.error?.code === '190') return null;
        }
      } catch {
        // ignore
      }

      return {
        name: participant.name ?? null,
        username: participant.username ?? null,
        profile_picture: participant.profile_pic ?? null,
      };
    }
  } catch {
    // ignore
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = await getAuthedUserId(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: ResolveBody = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }

  const conversationId = body.conversationId;
  if (!conversationId) {
    return new Response(JSON.stringify({ error: 'Missing conversationId' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Leer conversación
  const { data: conv, error: convError } = await supabaseService
    .from('conversations')
    .select('id, user_id, platform, platform_conversation_id, contact, contact_metadata')
    .eq('id', conversationId)
    .single();

  if (convError || !conv) {
    return new Response(JSON.stringify({ error: 'Conversation not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (conv.user_id !== userId) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (conv.platform !== 'instagram') {
    return new Response(JSON.stringify({ error: 'Not an instagram conversation' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const senderId = conv.platform_conversation_id;
  if (!senderId) {
    return new Response(JSON.stringify({ error: 'Missing platform_conversation_id' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Obtener integración para token
  const { data: integration } = await supabaseService
    .from('integrations')
    .select('config')
    .eq('type', 'instagram')
    .eq('user_id', userId)
    .eq('status', 'connected')
    .single();

  const accessToken = integration?.config?.access_token;
  const instagramBusinessAccountId =
    integration?.config?.instagram_user_id || integration?.config?.instagram_business_account_id;

  if (!accessToken || !instagramBusinessAccountId) {
    return new Response(JSON.stringify({ error: 'Instagram integration not configured' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const profile = await getInstagramUserProfile({
    accessToken,
    instagramBusinessAccountId,
    senderId,
  });

  if (!profile || (!profile.username && !profile.name)) {
    return new Response(JSON.stringify({ ok: false, updated: false }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const displayName = profile.username || profile.name || conv.contact;

  const { data: updated, error: updateError } = await supabaseService
    .from('conversations')
    .update({
      contact: displayName,
      contact_metadata: {
        ...(conv.contact_metadata || {}),
        username: profile.username ?? undefined,
        name: profile.name ?? undefined,
        profile_picture: profile.profile_picture ?? undefined,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .select('*')
    .single();

  if (updateError) {
    return new Response(JSON.stringify({ error: 'Failed to update' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, updated: true, conversation: updated }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});


