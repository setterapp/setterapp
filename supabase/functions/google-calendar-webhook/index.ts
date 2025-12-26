import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Función para refrescar token de Google si está expirado
async function refreshGoogleTokenIfNeeded(integration: any) {
  const tokenExpiresAt = integration.config?.token_expires_at;
  const refreshToken = integration.config?.provider_refresh_token;

  if (!tokenExpiresAt || !refreshToken) {
    return integration.config?.provider_token;
  }

  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  const isExpired = (expiresAt.getTime() - now.getTime()) < (5 * 60 * 1000);

  if (!isExpired) {
    return integration.config?.provider_token;
  }

  console.log('[google-calendar-webhook] Token expired, refreshing...');

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

  if (!tokenResponse.ok) {
    throw new Error('Failed to refresh Google token');
  }

  const tokenData = await tokenResponse.json();
  const newAccessToken = tokenData.access_token;
  const expiresIn = tokenData.expires_in || 3600;

  const updatedConfig = {
    ...integration.config,
    provider_token: newAccessToken,
    token_expires_at: new Date(Date.now() + (expiresIn * 1000)).toISOString(),
    last_token_refresh: new Date().toISOString(),
  };

  await supabase
    .from('integrations')
    .update({ config: updatedConfig })
    .eq('id', integration.id);

  console.log('[google-calendar-webhook] Token refreshed successfully');

  return newAccessToken;
}

// Sincronizar un calendario específico
async function syncCalendarForUser(userId: string, accessToken: string) {
  console.log(`[google-calendar-webhook] Syncing calendar for user ${userId}`);

  // Obtener eventos de los próximos 30 días
  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setHours(0, 0, 0, 0);

  const timeMax = new Date(now);
  timeMax.setDate(timeMax.getDate() + 30);
  timeMax.setHours(23, 59, 59, 999);

  const calendarParams = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
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

  if (!calendarResponse.ok) {
    console.error(`[google-calendar-webhook] Calendar API error for user ${userId}`);
    return 0;
  }

  const calendarData = await calendarResponse.json();
  const events = calendarData.items || [];

  console.log(`[google-calendar-webhook] Found ${events.length} events for user ${userId}`);

  let synced = 0;

  for (const event of events) {
    try {
      const startTime = event.start?.dateTime || event.start?.date;
      const endTime = event.end?.dateTime || event.end?.date;

      if (!startTime || !endTime) {
        continue;
      }

      await supabase
        .from('calendar_events')
        .upsert({
          user_id: userId,
          google_event_id: event.id,
          summary: event.summary || 'Sin título',
          description: event.description || null,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          is_all_day: !event.start?.dateTime,
          status: event.status || 'confirmed',
          last_synced_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,google_event_id',
          ignoreDuplicates: false,
        });

      synced++;
    } catch (eventError) {
      console.error(`[google-calendar-webhook] Error upserting event ${event.id}:`, eventError);
    }
  }

  return synced;
}

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Goog-Channel-Id, X-Goog-Channel-Token, X-Goog-Resource-Id, X-Goog-Resource-State, X-Goog-Resource-Uri',
      },
    });
  }

  try {
    // Headers de Google Calendar Push Notifications
    const channelId = req.headers.get('X-Goog-Channel-Id');
    const resourceState = req.headers.get('X-Goog-Resource-State'); // sync, exists, not_exists
    const resourceId = req.headers.get('X-Goog-Resource-Id');

    console.log('[google-calendar-webhook] === WEBHOOK RECIBIDO ===', {
      channelId,
      resourceState,
      resourceId,
    });

    // Si es una notificación de sync inicial, solo respondemos 200
    if (resourceState === 'sync') {
      console.log('[google-calendar-webhook] Sync notification received');
      return new Response(JSON.stringify({ received: true, type: 'sync' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Si hay cambios (exists), sincronizar el calendario
    if (resourceState === 'exists') {
      console.log('[google-calendar-webhook] Calendar change detected, syncing...');

      // Buscar la integración asociada a este channelId
      const { data: integration, error: integrationError } = await supabase
        .from('integrations')
        .select('*')
        .eq('type', 'google-calendar')
        .eq('status', 'connected')
        .contains('config', { calendar_watch_channel_id: channelId })
        .single();

      if (integrationError || !integration) {
        console.error('[google-calendar-webhook] Integration not found for channel:', channelId);
        return new Response(JSON.stringify({ error: 'Integration not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const userId = integration.user_id;
      console.log(`[google-calendar-webhook] Syncing for user ${userId}`);

      // Obtener access token
      const accessToken = await refreshGoogleTokenIfNeeded(integration);

      if (!accessToken) {
        throw new Error('No access token available');
      }

      // Sincronizar calendario
      const eventsSynced = await syncCalendarForUser(userId, accessToken);

      console.log(`[google-calendar-webhook] ✅ Synced ${eventsSynced} events for user ${userId}`);

      return new Response(JSON.stringify({
        success: true,
        user_id: userId,
        events_synced: eventsSynced,
        message: 'Calendar synced successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Otros tipos de notificaciones
    console.log('[google-calendar-webhook] Unhandled resource state:', resourceState);
    return new Response(JSON.stringify({ received: true, state: resourceState }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[google-calendar-webhook] ERROR:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
