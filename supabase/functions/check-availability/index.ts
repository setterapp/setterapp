import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CheckAvailabilityRequest {
  user_id: string;
  days_ahead?: number; // Default: 10 días
}

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

// Refrescar token de Google si está expirado
async function refreshGoogleTokenIfNeeded(integration: any) {
  const tokenExpiresAt = integration.config?.token_expires_at;
  const refreshToken = integration.config?.provider_refresh_token;

  if (!tokenExpiresAt || !refreshToken) {
    return integration.config?.provider_token;
  }

  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  const isExpired = (expiresAt.getTime() - now.getTime()) < (5 * 60 * 1000); // 5 min margen

  if (!isExpired) {
    return integration.config?.provider_token;
  }

  console.log('[check-availability] Token expired, refreshing...');

  // Refrescar token con Google
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

  // Actualizar en DB
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

  console.log('[check-availability] Token refreshed successfully');

  return newAccessToken;
}

Deno.serve(async (req: Request) => {
  // CORS
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
    const body: CheckAvailabilityRequest = await req.json();
    const { user_id, days_ahead = 10 } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[check-availability] Checking for user ${user_id}, ${days_ahead} days ahead`);

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
        JSON.stringify({
          error: 'Google Calendar not connected',
          available_slots: [],
          total_slots: 0
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener access token (y refrescar si es necesario)
    const accessToken = await refreshGoogleTokenIfNeeded(integration);

    if (!accessToken) {
      throw new Error('No access token available');
    }

    // Obtener agente de Instagram del usuario para config de horarios
    const { data: agent } = await supabase
      .from('agents')
      .select('config')
      .eq('user_id', user_id)
      .eq('platform', 'instagram')
      .single();

    // Configuración de disponibilidad (con defaults sensatos)
    const agentConfig = agent?.config || {};
    const duration = agentConfig.meetingDuration || 30;
    const bufferMinutes = agentConfig.meetingBufferMinutes || 0;
    const availableHoursStart = agentConfig.meetingAvailableHoursStart || '09:00';
    const availableHoursEnd = agentConfig.meetingAvailableHoursEnd || '18:00';
    const availableDays = agentConfig.meetingAvailableDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const timezone = agentConfig.meetingTimezone || 'America/Argentina/Buenos_Aires';

    console.log(`[check-availability] Using config:`, {
      duration,
      bufferMinutes,
      availableHoursStart,
      availableHoursEnd,
      availableDays,
      timezone
    });

    // Calcular rango de fechas
    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setHours(0, 0, 0, 0);

    const timeMax = new Date(now);
    timeMax.setDate(timeMax.getDate() + days_ahead);
    timeMax.setHours(23, 59, 59, 999);

    // Obtener eventos ocupados del calendario
    const calendarParams = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '100',
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
      const errorData = await calendarResponse.json().catch(() => ({}));
      console.error('[check-availability] Calendar API error:', errorData);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch calendar events',
          occupied_events: [],
          work_hours: {
            start: availableHoursStart,
            end: availableHoursEnd,
            days: availableDays
          },
          timezone: timezone,
          current_datetime: now.toISOString()
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const calendarData = await calendarResponse.json();
    const events = calendarData.items || [];

    // Formatear eventos ocupados con información legible
    const formattedEvents = events.map((event: any) => {
      const start = new Date(event.start?.dateTime || event.start?.date);
      const end = new Date(event.end?.dateTime || event.end?.date);

      return {
        id: event.id,
        title: event.summary || 'Sin título',
        start: start.toISOString(),
        end: end.toISOString(),
        start_local: start.toLocaleString('es-AR', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }),
        end_local: end.toLocaleString('es-AR', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }),
        date_local: start.toLocaleDateString('es-AR', { timeZone: timezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      };
    });

    console.log(`[check-availability] Found ${formattedEvents.length} occupied events`);

    // Formatear current_datetime de forma clara
    const currentDateTimeLocal = now.toLocaleString('es-AR', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    return new Response(
      JSON.stringify({
        occupied_events: formattedEvents,
        total_events: formattedEvents.length,
        work_hours: {
          start: availableHoursStart,
          end: availableHoursEnd,
          days: availableDays
        },
        timezone: timezone,
        duration_minutes: duration,
        buffer_minutes: bufferMinutes,
        current_datetime_iso: now.toISOString(),
        current_datetime_local: currentDateTimeLocal,
        range: {
          from: timeMin.toISOString(),
          to: timeMax.toISOString()
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[check-availability] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        occupied_events: [],
        total_events: 0
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
