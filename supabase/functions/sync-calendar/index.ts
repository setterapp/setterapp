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

  console.log('[sync-calendar] Token expired, refreshing...');

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

  console.log('[sync-calendar] Token refreshed successfully');

  return newAccessToken;
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
    console.log('[sync-calendar] === INICIO SINCRONIZACIÓN ===');

    // Verificar si la tabla calendar_events existe intentando hacer una query
    console.log('[sync-calendar] Verificando tabla calendar_events...');
    const { error: tableCheckError } = await supabase
      .from('calendar_events')
      .select('id')
      .limit(1);

    if (tableCheckError && tableCheckError.message.includes('does not exist')) {
      console.log('[sync-calendar] Tabla calendar_events no existe, necesita ser creada manualmente');
      return new Response(
        JSON.stringify({
          error: 'Table calendar_events does not exist. Please run the migration SQL first.',
          sql: `
create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null,
  google_event_id text not null,
  summary text,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  is_all_day boolean default false,
  status text default 'confirmed',
  last_synced_at timestamptz default now(),
  constraint calendar_events_user_google_unique unique(user_id, google_event_id)
);
create index calendar_events_user_id_idx on calendar_events(user_id);
create index calendar_events_start_time_idx on calendar_events(start_time);
alter table calendar_events enable row level security;
create policy "Service role has full access to calendar events" on calendar_events for all using (true) with check (true);
          `
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[sync-calendar] Tabla calendar_events existe');

    // Obtener todas las integraciones activas de Google Calendar
    const { data: integrations, error: integrationsError } = await supabase
      .from('integrations')
      .select('*')
      .eq('type', 'google-calendar')
      .eq('status', 'connected');

    if (integrationsError) {
      throw new Error(`Error getting integrations: ${integrationsError.message}`);
    }

    if (!integrations || integrations.length === 0) {
      console.log('[sync-calendar] No hay integraciones de Google Calendar activas');
      return new Response(
        JSON.stringify({ message: 'No active Google Calendar integrations', synced: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-calendar] Sincronizando ${integrations.length} calendarios`);

    let totalEventsSynced = 0;

    for (const integration of integrations) {
      const userId = integration.user_id;
      console.log(`[sync-calendar] Sincronizando calendario para user ${userId}`);

      try {
        // Obtener access token
        const accessToken = await refreshGoogleTokenIfNeeded(integration);

        if (!accessToken) {
          console.error(`[sync-calendar] No access token for user ${userId}`);
          continue;
        }

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
          console.error(`[sync-calendar] Calendar API error for user ${userId}`);
          continue;
        }

        const calendarData = await calendarResponse.json();
        const events = calendarData.items || [];

        console.log(`[sync-calendar] Encontrados ${events.length} eventos para user ${userId}`);

        // Upsert eventos en la tabla calendar_events
        for (const event of events) {
          try {
            const startTime = event.start?.dateTime || event.start?.date;
            const endTime = event.end?.dateTime || event.end?.date;

            if (!startTime || !endTime) {
              console.warn(`[sync-calendar] Event ${event.id} missing start/end time`);
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
                is_all_day: !event.start?.dateTime, // Si no tiene dateTime, es all-day
                status: event.status || 'confirmed',
                last_synced_at: new Date().toISOString(),
              }, {
                onConflict: 'user_id,google_event_id',
                ignoreDuplicates: false, // Actualizar si ya existe
              });

            totalEventsSynced++;
          } catch (eventError) {
            console.error(`[sync-calendar] Error upserting event ${event.id}:`, eventError);
          }
        }

        console.log(`[sync-calendar] ✅ Sincronizado user ${userId}: ${events.length} eventos`);

      } catch (userError) {
        console.error(`[sync-calendar] Error syncing user ${userId}:`, userError);
      }
    }

    // Limpiar eventos pasados (más de 1 día atrás)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { error: deleteError } = await supabase
      .from('calendar_events')
      .delete()
      .lt('end_time', oneDayAgo.toISOString());

    if (deleteError) {
      console.error('[sync-calendar] Error deleting old events:', deleteError);
    } else {
      console.log('[sync-calendar] ✅ Eventos pasados eliminados');
    }

    console.log(`[sync-calendar] === FIN: ${totalEventsSynced} eventos sincronizados ===`);

    return new Response(
      JSON.stringify({
        success: true,
        users_synced: integrations.length,
        events_synced: totalEventsSynced,
        message: `Synced ${totalEventsSynced} events from ${integrations.length} calendars`
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-calendar] ERROR:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
