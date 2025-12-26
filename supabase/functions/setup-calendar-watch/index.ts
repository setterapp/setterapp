import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// URL del webhook que Google Calendar llamará
const WEBHOOK_URL = `${supabaseUrl}/functions/v1/google-calendar-webhook`;

interface SetupWatchRequest {
  user_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const body: SetupWatchRequest = await req.json();
    const { user_id } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[setup-calendar-watch] Setting up watch for user ${user_id}`);

    // Obtener integración de Google Calendar
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('type', 'google-calendar')
      .eq('user_id', user_id)
      .eq('status', 'connected')
      .single();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: 'Google Calendar not connected' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = integration.config?.provider_token;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'No access token available' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generar un channel ID único
    const channelId = `calendar-${user_id}-${Date.now()}`;
    const channelToken = crypto.randomUUID();

    // Registrar watch con Google Calendar
    // Docs: https://developers.google.com/calendar/api/guides/push
    const watchResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events/watch',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: channelId,
          type: 'web_hook',
          address: WEBHOOK_URL,
          token: channelToken,
          expiration: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 días
        }),
      }
    );

    if (!watchResponse.ok) {
      const errorData = await watchResponse.json().catch(() => ({}));
      console.error('[setup-calendar-watch] Watch API error:', errorData);
      return new Response(
        JSON.stringify({
          error: 'Failed to setup calendar watch',
          details: errorData
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const watchData = await watchResponse.json();

    console.log('[setup-calendar-watch] Watch created:', {
      channelId: watchData.id,
      resourceId: watchData.resourceId,
      expiration: new Date(parseInt(watchData.expiration)).toISOString(),
    });

    // Guardar información del watch en la integración
    const updatedConfig = {
      ...integration.config,
      calendar_watch_channel_id: watchData.id,
      calendar_watch_resource_id: watchData.resourceId,
      calendar_watch_expiration: new Date(parseInt(watchData.expiration)).toISOString(),
      calendar_watch_token: channelToken,
      calendar_watch_created_at: new Date().toISOString(),
    };

    await supabase
      .from('integrations')
      .update({ config: updatedConfig })
      .eq('id', integration.id);

    console.log(`[setup-calendar-watch] ✅ Watch setup complete for user ${user_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        channel_id: watchData.id,
        resource_id: watchData.resourceId,
        expiration: new Date(parseInt(watchData.expiration)).toISOString(),
        webhook_url: WEBHOOK_URL,
        message: 'Calendar watch setup successfully. Events will now sync automatically.'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[setup-calendar-watch] ERROR:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
