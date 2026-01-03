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

    // IMPORTANT: Parse as text first to preserve large integer precision
    // JSON.parse() corrupts integers > 2^53 (like Instagram user IDs)
    const responseText = await response.text();

    // Extract user_id as string BEFORE JSON.parse corrupts it
    const userIdMatch = responseText.match(/"user_id"\s*:\s*(\d+)/);
    const preservedUserId = userIdMatch ? userIdMatch[1] : null;

    const data = JSON.parse(responseText);

    // Use the preserved string version instead of the corrupted number
    const safeUserId = preservedUserId || (data.user_id != null ? String(data.user_id) : null);
    console.log('🔑 User ID preserved from raw response:', preservedUserId);

    // 2) Exchange short-lived token for long-lived token (60 days instead of 1 hour)
    let finalAccessToken = data.access_token;
    let expiresIn: number | null = null;
    let tokenType: string | null = null;

    console.log('🔄 Exchanging short-lived token for long-lived token...');

    try {
      const longLivedUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(INSTAGRAM_APP_SECRET)}&access_token=${encodeURIComponent(data.access_token)}`;
      const longLived = await fetch(longLivedUrl, { method: 'GET' });

      const llText = await longLived.text();
      console.log('📡 Long-lived token response:', longLived.status, llText.substring(0, 200));

      if (longLived.ok) {
        try {
          const ll = JSON.parse(llText);
          if (ll?.access_token) {
            finalAccessToken = ll.access_token;
            expiresIn = typeof ll.expires_in === 'number' ? ll.expires_in : null;
            tokenType = ll.token_type || null;
            const expiryDays = expiresIn ? Math.round(expiresIn / 86400) : 'unknown';
            console.log(`✅ Got long-lived token! Expires in ${expiryDays} days`);
          } else {
            console.warn('⚠️ Long-lived response missing access_token:', ll);
          }
        } catch (parseErr) {
          console.warn('⚠️ Could not parse long-lived token response:', parseErr);
        }
      } else {
        console.error('❌ Long-lived token exchange failed:', longLived.status, llText);
      }
    } catch (e) {
      console.error('❌ Long-lived exchange exception:', e);
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
    // This is CRITICAL for external users (not app testers) to receive messages and comments
    // Using /me/subscribed_apps as per Meta documentation
    let webhookSubscribed = false;
    try {
      console.log('📡 Subscribing to webhooks using /me/subscribed_apps...');

      // Subscribe to messages AND comments webhooks - /me resolves to the user's IG professional account
      const subscribeResponse = await fetch(
        `https://graph.instagram.com/v24.0/me/subscribed_apps?subscribed_fields=messages,comments&access_token=${encodeURIComponent(finalAccessToken)}`,
        {
          method: 'POST',
        }
      );

      const subscribeText = await subscribeResponse.text();
      console.log('📡 Webhook subscription response:', subscribeResponse.status, subscribeText);

      if (subscribeResponse.ok) {
        try {
          const subscribeData = JSON.parse(subscribeText);
          webhookSubscribed = subscribeData.success === true;
          if (webhookSubscribed) {
            console.log('✅ Successfully subscribed to webhooks (messages + comments)');
          } else {
            console.warn('⚠️ Webhook subscription returned:', subscribeData);
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

    // Return token data including instagram_business_account_id for webhook matching
    // IMPORTANT: Use safeUserId which was extracted as string before JSON.parse corrupted it
    return new Response(
      JSON.stringify({
        access_token: finalAccessToken,
        user_id: safeUserId,
        username: username,
        instagram_business_account_id: instagramBusinessAccountId != null ? String(instagramBusinessAccountId) : null,
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






