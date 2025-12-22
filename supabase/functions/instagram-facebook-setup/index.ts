import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

type Body = {
  provider_token?: string; // Facebook user access token from Supabase session.provider_token
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

async function getAuthedUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null;

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await supabaseAuth.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
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

  let body: Body = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const providerToken = body.provider_token;
  if (!providerToken) {
    return new Response(JSON.stringify({ error: 'Missing provider_token' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Fetch pages + page access tokens + linked instagram business account
  const url = new URL('https://graph.facebook.com/v24.0/me/accounts');
  url.searchParams.set('fields', 'id,name,access_token,instagram_business_account{id,username}');
  url.searchParams.set('access_token', providerToken);

  const resp = await fetch(url.toString(), { method: 'GET' });
  const data = await resp.json().catch(() => null);

  if (!resp.ok || !data || data.error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch pages', details: data?.error || data }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const pages: any[] = Array.isArray(data.data) ? data.data : [];
  const withIg = pages.find(p => p?.instagram_business_account?.id && p?.access_token);
  if (!withIg) {
    return new Response(JSON.stringify({ error: 'No Facebook Page with linked Instagram Business account found' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const pageId = String(withIg.id);
  const pageAccessToken = String(withIg.access_token);
  const igBusinessId = String(withIg.instagram_business_account.id);
  const igUsername = withIg.instagram_business_account.username ?? null;

  // Persist into integrations.config for this user
  const { data: integrations } = await supabaseService
    .from('integrations')
    .select('id, config')
    .eq('type', 'instagram')
    .eq('user_id', userId)
    .limit(1);

  const existing = integrations?.[0];
  if (!existing?.id) {
    // Create if missing
    await supabaseService
      .from('integrations')
      .insert({
        user_id: userId,
        type: 'instagram',
        name: 'Instagram',
        status: 'connected',
        connected_at: new Date().toISOString(),
        config: {
          page_id: pageId,
          page_access_token: pageAccessToken,
          instagram_business_account_id: igBusinessId,
          instagram_business_username: igUsername,
        },
      });
  } else {
    await supabaseService
      .from('integrations')
      .update({
        status: 'connected',
        connected_at: new Date().toISOString(),
        config: {
          ...(existing.config || {}),
          page_id: pageId,
          page_access_token: pageAccessToken,
          instagram_business_account_id: igBusinessId,
          instagram_business_username: igUsername,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('user_id', userId);
  }

  return new Response(JSON.stringify({
    ok: true,
    page_id: pageId,
    instagram_business_account_id: igBusinessId,
    instagram_business_username: igUsername,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
