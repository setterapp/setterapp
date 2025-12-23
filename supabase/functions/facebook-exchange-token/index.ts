import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const FACEBOOK_APP_ID = Deno.env.get('INSTAGRAM_APP_ID') || '1206229924794990';
const FACEBOOK_APP_SECRET = Deno.env.get('INSTAGRAM_APP_SECRET') || '';

console.log('Facebook Exchange Token function initialized');

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
    const { code, redirect_uri } = await req.json();

    if (!code || !redirect_uri) {
      return new Response(
        JSON.stringify({ error: 'Se requiere code y redirect_uri' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!FACEBOOK_APP_SECRET) {
      console.error('❌ INSTAGRAM_APP_SECRET no está configurado');
      return new Response(
        JSON.stringify({ error: 'Configuración del servidor incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📘 Step 1: Intercambiando código por User Access Token...');

    // Paso 1: Intercambiar código por User Access Token
    const tokenUrl = new URL('https://graph.facebook.com/v24.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', FACEBOOK_APP_ID);
    tokenUrl.searchParams.set('client_secret', FACEBOOK_APP_SECRET);
    tokenUrl.searchParams.set('redirect_uri', redirect_uri);
    tokenUrl.searchParams.set('code', code);

    const tokenResponse = await fetch(tokenUrl.toString());

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('❌ Error obteniendo User Access Token:', errorData);
      return new Response(
        JSON.stringify({ error: errorData.error?.message || 'Error obteniendo token' }),
        { status: tokenResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    const userAccessToken = tokenData.access_token;

    if (!userAccessToken) {
      console.error('❌ No se recibió access_token');
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
      return new Response(
        JSON.stringify({
          error: 'No tienes páginas de Facebook. Crea una página en facebook.com/pages/create y vincula tu cuenta de Instagram Business.'
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
