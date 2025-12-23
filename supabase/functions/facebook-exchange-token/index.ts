import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

// IMPORTANT:
// The OAuth `code` is issued for a specific App ID.
// If we exchange it with a different App ID/Secret, Graph API returns:
// "Error validating application. Cannot get application info due to a system error."
//
// Prefer explicit FACEBOOK_* secrets. Fallback to INSTAGRAM_* for backwards compatibility.
const FACEBOOK_APP_ID =
  Deno.env.get('FACEBOOK_APP_ID') ||
  Deno.env.get('INSTAGRAM_APP_ID') ||
  '1206229924794990';

const FACEBOOK_APP_SECRET =
  Deno.env.get('FACEBOOK_APP_SECRET') ||
  Deno.env.get('INSTAGRAM_APP_SECRET') ||
  '';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabaseService = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

console.log('Facebook Exchange Token function initialized');

async function getAuthedUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') || '';
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null;
  try {
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error } = await supabaseAuth.auth.getUser();
    if (error) return null;
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

async function logDebugEvent(params: {
  userId: string | null;
  requestId: string;
  stage: string;
  payload: Record<string, any>;
}) {
  if (!supabaseService) return;
  try {
    await supabaseService
      .from('facebook_oauth_debug_events')
      .insert({
        user_id: params.userId,
        request_id: params.requestId,
        stage: params.stage,
        payload: params.payload,
      });
  } catch {
    // never fail the flow due to debug logging
  }
}

Deno.serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const requestId = crypto.randomUUID();
    const userId = await getAuthedUserId(req);

    const { code, redirect_uri } = await req.json();

    if (!code || !redirect_uri) {
      await logDebugEvent({
        userId,
        requestId,
        stage: 'bad_request',
        payload: { has_code: Boolean(code), redirect_uri: redirect_uri ?? null },
      });
      return new Response(
        JSON.stringify({ error: 'Se requiere code y redirect_uri' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!FACEBOOK_APP_SECRET) {
      console.error('❌ FACEBOOK_APP_SECRET / INSTAGRAM_APP_SECRET no está configurado');
      await logDebugEvent({
        userId,
        requestId,
        stage: 'server_misconfigured',
        payload: { reason: 'missing_app_secret', app_id: FACEBOOK_APP_ID },
      });
      return new Response(
        JSON.stringify({ error: 'Configuración del servidor incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!/^\d+$/.test(String(FACEBOOK_APP_ID))) {
      console.error('❌ FACEBOOK_APP_ID inválido:', FACEBOOK_APP_ID);
      await logDebugEvent({
        userId,
        requestId,
        stage: 'server_misconfigured',
        payload: { reason: 'invalid_app_id', app_id: FACEBOOK_APP_ID },
      });
      return new Response(
        JSON.stringify({ error: 'Configuración del servidor incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await logDebugEvent({
      userId,
      requestId,
      stage: 'start',
      payload: {
        redirect_uri,
        app_id: FACEBOOK_APP_ID,
        has_code: true, // do not store code
        has_auth_header: Boolean(req.headers.get('Authorization')),
      },
    });

    console.log('📘 Step 1: Intercambiando código por User Access Token...');

    // Paso 1: Intercambiar código por User Access Token
    const tokenUrl = new URL('https://graph.facebook.com/v24.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', FACEBOOK_APP_ID);
    tokenUrl.searchParams.set('client_secret', FACEBOOK_APP_SECRET);
    tokenUrl.searchParams.set('redirect_uri', redirect_uri);
    tokenUrl.searchParams.set('code', code);

    const tokenResponse = await fetch(tokenUrl.toString());

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error('❌ Error obteniendo User Access Token:', errorData);
      await logDebugEvent({
        userId,
        requestId,
        stage: 'token_exchange_error',
        payload: {
          http_status: tokenResponse.status,
          error: errorData?.error?.message ?? null,
          code: errorData?.error?.code ?? null,
          type: errorData?.error?.type ?? null,
          fbtrace_id: errorData?.error?.fbtrace_id ?? null,
        },
      });
      return new Response(
        JSON.stringify({
          error: errorData.error?.message || 'Error obteniendo token',
          code: errorData.error?.code,
          type: errorData.error?.type,
          fbtrace_id: errorData.error?.fbtrace_id,
        }),
        { status: tokenResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    const userAccessToken = tokenData.access_token;

    if (!userAccessToken) {
      console.error('❌ No se recibió access_token');
      await logDebugEvent({
        userId,
        requestId,
        stage: 'token_exchange_error',
        payload: { error: 'missing_access_token_in_response' },
      });
      return new Response(
        JSON.stringify({ error: 'No se recibió access token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User Access Token obtenido');
    console.log('📘 Step 2: Obteniendo páginas de Facebook con Instagram vinculado...');

    // Paso 2: Obtener páginas de Facebook con Instagram Business Account
    const pagesUrl = new URL('https://graph.facebook.com/v24.0/me/accounts');
    pagesUrl.searchParams.set('fields', 'id,name,access_token,instagram_business_account{id,username}');
    pagesUrl.searchParams.set('access_token', userAccessToken);

    const pagesResponse = await fetch(pagesUrl.toString());

    if (!pagesResponse.ok) {
      const errorData = await pagesResponse.json();
      console.error('❌ Error obteniendo páginas:', errorData);
      return new Response(
        JSON.stringify({ error: 'Error obteniendo páginas de Facebook' }),
        { status: pagesResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pagesData = await pagesResponse.json();
    const pages = pagesData.data || [];

    console.log(`📄 ${pages.length} página(s) de Facebook encontradas`);

    if (pages.length === 0) {
      // Diagnóstico extra (sin exponer tokens): permisos concedidos + debug_token
      let permissions: any = null;
      let debugToken: any = null;
      let me: any = null;
      try {
        const meRes = await fetch(`https://graph.facebook.com/v24.0/me?fields=id,name&access_token=${encodeURIComponent(userAccessToken)}`);
        me = await meRes.json().catch(() => null);
      } catch {
        // ignore
      }
      try {
        const permRes = await fetch(`https://graph.facebook.com/v24.0/me/permissions?access_token=${encodeURIComponent(userAccessToken)}`);
        permissions = await permRes.json().catch(() => null);
      } catch {
        // ignore
      }
      try {
        const appAccessToken = `${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}`;
        const dbgRes = await fetch(
          `https://graph.facebook.com/v24.0/debug_token?input_token=${encodeURIComponent(userAccessToken)}&access_token=${encodeURIComponent(appAccessToken)}`
        );
        debugToken = await dbgRes.json().catch(() => null);
      } catch {
        // ignore
      }

      await logDebugEvent({
        userId,
        requestId,
        stage: 'no_pages',
        payload: {
          me,
          permissions,
          debug_token: debugToken?.data ? {
            app_id: debugToken.data.app_id,
            type: debugToken.data.type,
            is_valid: debugToken.data.is_valid,
            scopes: debugToken.data.scopes,
            granular_scopes: debugToken.data.granular_scopes,
            user_id: debugToken.data.user_id,
            expires_at: debugToken.data.expires_at,
            data_access_expires_at: debugToken.data.data_access_expires_at,
          } : debugToken,
        },
      });

      // Fallback for granular permissions:
      // Sometimes /me/accounts returns empty even when granular_scopes contains selected Page IDs.
      // In that case, we can try to resolve the page access token by querying each target Page directly.
      try {
        const granularScopes: any[] = Array.isArray(debugToken?.data?.granular_scopes)
          ? debugToken.data.granular_scopes
          : [];
        const targetPageIds = new Set<string>();
        for (const gs of granularScopes) {
          if (!gs) continue;
          if (gs.scope !== 'pages_show_list' && gs.scope !== 'pages_read_engagement' && gs.scope !== 'pages_manage_metadata' && gs.scope !== 'pages_messaging') continue;
          const ids: any[] = Array.isArray(gs.target_ids) ? gs.target_ids : [];
          for (const id of ids) {
            if (typeof id === 'string' && id.trim()) targetPageIds.add(id.trim());
            if (typeof id === 'number') targetPageIds.add(String(id));
          }
        }

        if (targetPageIds.size > 0) {
          console.log('📌 Fallback: intentando resolver Page Access Token via granular target_ids:', Array.from(targetPageIds));

          const candidates: any[] = [];
          for (const pageId of targetPageIds) {
            try {
              const pageRes = await fetch(
                `https://graph.facebook.com/v24.0/${pageId}?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(userAccessToken)}`,
                { method: 'GET' }
              );
              const pageJson = await pageRes.json().catch(() => null);
              if (pageRes.ok && pageJson && !pageJson.error) {
                candidates.push(pageJson);
              } else {
                await logDebugEvent({
                  userId,
                  requestId,
                  stage: 'granular_page_fetch_failed',
                  payload: {
                    page_id: pageId,
                    http_status: pageRes.status,
                    error: pageJson?.error?.message ?? null,
                    code: pageJson?.error?.code ?? null,
                    type: pageJson?.error?.type ?? null,
                    fbtrace_id: pageJson?.error?.fbtrace_id ?? null,
                  },
                });
              }
            } catch (e: any) {
              await logDebugEvent({
                userId,
                requestId,
                stage: 'granular_page_fetch_failed',
                payload: { page_id: pageId, error: e?.message ?? String(e) },
              });
            }
          }

          const pageWithInstagram = candidates.find((p: any) =>
            p?.instagram_business_account?.id && p?.access_token
          );

          if (pageWithInstagram) {
            await logDebugEvent({
              userId,
              requestId,
              stage: 'success_via_granular_fallback',
              payload: {
                page_id: pageWithInstagram.id,
                page_name: pageWithInstagram.name,
                instagram_business_account_id: pageWithInstagram.instagram_business_account.id,
                instagram_username: pageWithInstagram.instagram_business_account.username,
              },
            });

            return new Response(
              JSON.stringify({
                pageAccessToken: pageWithInstagram.access_token,
                pageId: pageWithInstagram.id,
                instagramBusinessAccountId: pageWithInstagram.instagram_business_account.id,
                instagramUsername: pageWithInstagram.instagram_business_account.username,
                pageName: pageWithInstagram.name,
                via: 'granular_fallback',
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch {
        // ignore fallback errors, return default message below
      }

      return new Response(
        JSON.stringify({
          error: 'Facebook Graph devolvió 0 páginas en /me/accounts. Esto suele ocurrir si tu usuario no tiene “Facebook access” sobre la Page (solo task access/Business Suite) o si el login no concedió permisos de Pages.',
          hint: 'Asegúrate de tener al menos una Page con “People with Facebook access” (Full control) y vuelve a autorizar. Si la Page está en Business Manager, revisa que tengas acceso directo a la Page.',
          diagnostics: {
            me,
            permissions,
            debug_token: debugToken?.data ? {
              app_id: debugToken.data.app_id,
              type: debugToken.data.type,
              is_valid: debugToken.data.is_valid,
              scopes: debugToken.data.scopes,
              granular_scopes: debugToken.data.granular_scopes,
              user_id: debugToken.data.user_id,
              expires_at: debugToken.data.expires_at,
              data_access_expires_at: debugToken.data.data_access_expires_at,
            } : debugToken,
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar la primera página que tenga Instagram Business Account
    const pageWithInstagram = pages.find((page: any) =>
      page.instagram_business_account && page.instagram_business_account.id && page.access_token
    );

    if (!pageWithInstagram) {
      const pageNames = pages.map((p: any) => p.name || 'Sin nombre').join(', ');
      await logDebugEvent({
        userId,
        requestId,
        stage: 'no_page_with_instagram',
        payload: { pages_count: pages.length, page_names: pageNames },
      });
      return new Response(
        JSON.stringify({
          error: `Ninguna de tus ${pages.length} página(s) [${pageNames}] tiene una Cuenta de Instagram Business vinculada. Ve a la configuración de tu página en Facebook para vincular Instagram.`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Página con Instagram encontrada:', {
      page_name: pageWithInstagram.name,
      page_id: pageWithInstagram.id,
      instagram_username: pageWithInstagram.instagram_business_account.username,
    });

    await logDebugEvent({
      userId,
      requestId,
      stage: 'success',
      payload: {
        page_id: pageWithInstagram.id,
        page_name: pageWithInstagram.name,
        instagram_business_account_id: pageWithInstagram.instagram_business_account.id,
        instagram_username: pageWithInstagram.instagram_business_account.username,
      },
    });

    // Retornar los datos necesarios
    return new Response(
      JSON.stringify({
        pageAccessToken: pageWithInstagram.access_token,
        pageId: pageWithInstagram.id,
        instagramBusinessAccountId: pageWithInstagram.instagram_business_account.id,
        instagramUsername: pageWithInstagram.instagram_business_account.username,
        pageName: pageWithInstagram.name,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in facebook-exchange-token:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
