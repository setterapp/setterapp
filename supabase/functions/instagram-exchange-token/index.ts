import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const INSTAGRAM_APP_ID = Deno.env.get('INSTAGRAM_APP_ID') || '';
const INSTAGRAM_APP_SECRET = Deno.env.get('INSTAGRAM_APP_SECRET') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

Deno.serve(async (req: Request) => {
  // Handle CORS
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

  try {
    const { code, redirect_uri } = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Code is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!INSTAGRAM_APP_ID || !INSTAGRAM_APP_SECRET) {
      console.error('❌ Instagram credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Instagram credentials not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 1) Exchange code for short-lived token
    const response = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: INSTAGRAM_APP_ID,
        client_secret: INSTAGRAM_APP_SECRET,
        redirect_uri: redirect_uri || '',
        code: code,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Error from Instagram API:', errorData);
      return new Response(
        JSON.stringify({
          error: errorData.error_message || errorData.error?.message || 'Error exchanging code for token',
          details: errorData,
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();

    // 2) Exchange short-lived token for long-lived token (improves expiry issues)
    let finalAccessToken = data.access_token;
    let expiresIn: number | null = null;
    let tokenType: string | null = null;

    try {
      const longLived = await fetch(
        `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(INSTAGRAM_APP_SECRET)}&access_token=${encodeURIComponent(data.access_token)}`,
        { method: 'GET' }
      );

      if (longLived.ok) {
        const ll = await longLived.json();
        if (ll?.access_token) {
          finalAccessToken = ll.access_token;
          expiresIn = typeof ll.expires_in === 'number' ? ll.expires_in : null;
          tokenType = ll.token_type || null;
        }
      } else {
        const t = await longLived.text();
        console.warn('⚠️ Could not exchange to long-lived token:', t);
      }
    } catch (e) {
      console.warn('⚠️ Long-lived exchange failed:', e);
    }

    // 3) Fetch user profile to get username AND instagram_business_account_id
    let username: string | null = null;
    let instagramBusinessAccountId: string | null = null;
    try {
      // Request both id, username, and user_id (which is the Instagram Business Account ID)
      const profileResponse = await fetch(
        `https://graph.instagram.com/me?fields=id,username,user_id&access_token=${encodeURIComponent(finalAccessToken)}`,
        { method: 'GET' }
      );

      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        username = profile.username || null;
        // user_id is the Instagram Business Account ID that Meta sends in webhooks
        instagramBusinessAccountId = profile.user_id || null;
        console.log('✅ Got Instagram profile:', {
          username,
          scoped_user_id: profile.id,
          instagram_business_account_id: instagramBusinessAccountId
        });
      } else {
        const errorText = await profileResponse.text();
        console.warn('⚠️ Could not fetch Instagram profile:', errorText);
      }
    } catch (e) {
      console.warn('⚠️ Profile fetch failed:', e);
    }

    // 4) Subscribe the Instagram Business Account to receive webhooks
    // This is CRITICAL for external users (not app testers) to receive messages
    let webhookSubscribed = false;
    if (instagramBusinessAccountId) {
      try {
        console.log('📡 Subscribing to webhooks for IG Business Account:', instagramBusinessAccountId);

        // Subscribe to messages webhook using the Instagram Business Account ID
        const subscribeResponse = await fetch(
          `https://graph.instagram.com/v21.0/${instagramBusinessAccountId}/subscribed_apps`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              subscribed_fields: 'messages',
              access_token: finalAccessToken,
            }),
          }
        );

        const subscribeText = await subscribeResponse.text();
        console.log('📡 Webhook subscription response:', subscribeResponse.status, subscribeText);

        if (subscribeResponse.ok) {
          try {
            const subscribeData = JSON.parse(subscribeText);
            webhookSubscribed = subscribeData.success === true;
            if (webhookSubscribed) {
              console.log('✅ Successfully subscribed to webhooks');
            } else {
              console.warn('⚠️ Webhook subscription returned false:', subscribeData);
            }
          } catch {
            console.warn('⚠️ Could not parse subscription response');
          }
        } else {
          console.warn('⚠️ Webhook subscription failed:', subscribeResponse.status, subscribeText);
        }
      } catch (e) {
        console.warn('⚠️ Webhook subscription error:', e);
      }
    }

    // Return token data including instagram_business_account_id for webhook matching
    return new Response(
      JSON.stringify({
        access_token: finalAccessToken,
        user_id: data.user_id || null,
        username: username,
        instagram_business_account_id: instagramBusinessAccountId,
        expires_in: expiresIn,
        token_type: tokenType,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('❌ Error in exchange token function:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});






