import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Get Google Calendar integration
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

    // Refresh token if needed
    let accessToken = integration.config?.provider_token;
    const tokenExpiresAt = integration.config?.token_expires_at;
    const refreshToken = integration.config?.provider_refresh_token;

    if (tokenExpiresAt && refreshToken) {
      const expiresAt = new Date(tokenExpiresAt);
      const now = new Date();
      const isExpired = (expiresAt.getTime() - now.getTime()) < (5 * 60 * 1000);

      if (isExpired) {
        console.log('[setup-calendar-watch] Token expired, refreshing...');
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
            client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
          }),
        });

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          accessToken = tokenData.access_token;
          const expiresIn = tokenData.expires_in || 3600;

          await supabase.from('integrations').update({
            config: {
              ...integration.config,
              provider_token: accessToken,
              token_expires_at: new Date(Date.now() + (expiresIn * 1000)).toISOString(),
            }
          }).eq('id', integration.id);

          console.log('[setup-calendar-watch] Token refreshed successfully');
        }
      }
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'No access token available' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. INITIAL SYNC - Fetch all events from last 30 days to next 30 days
    console.log('[setup-calendar-watch] Starting initial sync...');

    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setDate(timeMin.getDate() - 7); // 7 days ago
    const timeMax = new Date(now);
    timeMax.setDate(timeMax.getDate() + 60); // 60 days ahead

    const calendarParams = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '500',
    });

    const calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${calendarParams}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    let eventsSynced = 0;
    if (calendarResponse.ok) {
      const calendarData = await calendarResponse.json();
      const events = calendarData.items || [];

      console.log(`[setup-calendar-watch] Found ${events.length} events to sync`);

      // Clear existing events for this user and insert new ones
      await supabase.from('calendar_events').delete().eq('user_id', user_id);

      for (const event of events) {
        const startTime = event.start?.dateTime || event.start?.date;
        const endTime = event.end?.dateTime || event.end?.date;

        if (!startTime || !endTime) continue;

        await supabase.from('calendar_events').upsert({
          user_id: user_id,
          google_event_id: event.id,
          summary: event.summary || 'Sin título',
          description: event.description || null,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          is_all_day: !event.start?.dateTime,
          status: event.status || 'confirmed',
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'user_id,google_event_id' });

        eventsSynced++;
      }
      console.log(`[setup-calendar-watch] Initial sync complete: ${eventsSynced} events`);
    } else {
      console.error('[setup-calendar-watch] Failed to fetch events for initial sync');
    }

    // 2. SETUP WATCH for real-time updates
    const channelId = `calendar-${user_id}-${Date.now()}`;
    const channelToken = crypto.randomUUID();

    // Watch expires in 7 days (maximum allowed by Google is ~30 days)
    const expiration = Date.now() + (7 * 24 * 60 * 60 * 1000);

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
          expiration: expiration,
        }),
      }
    );

    if (!watchResponse.ok) {
      const errorData = await watchResponse.json().catch(() => ({}));
      console.error('[setup-calendar-watch] Watch API error:', errorData);

      // Even if watch fails, initial sync was done
      return new Response(
        JSON.stringify({
          success: true,
          partial: true,
          events_synced: eventsSynced,
          watch_error: errorData,
          message: 'Initial sync done but real-time updates failed. Events will be synced manually.'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const watchData = await watchResponse.json();

    console.log('[setup-calendar-watch] Watch created:', {
      channelId: watchData.id,
      resourceId: watchData.resourceId,
      expiration: new Date(parseInt(watchData.expiration)).toISOString(),
    });

    // Save watch info
    const updatedConfig = {
      ...integration.config,
      calendar_watch_channel_id: watchData.id,
      calendar_watch_resource_id: watchData.resourceId,
      calendar_watch_expiration: new Date(parseInt(watchData.expiration)).toISOString(),
      calendar_watch_token: channelToken,
      calendar_watch_created_at: new Date().toISOString(),
    };

    await supabase.from('integrations').update({ config: updatedConfig }).eq('id', integration.id);

    console.log(`[setup-calendar-watch] ✅ Complete for user ${user_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        events_synced: eventsSynced,
        channel_id: watchData.id,
        resource_id: watchData.resourceId,
        expiration: new Date(parseInt(watchData.expiration)).toISOString(),
        webhook_url: WEBHOOK_URL,
        message: `Calendar synced (${eventsSynced} events) and real-time updates activated.`
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
