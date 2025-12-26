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

// Helper para guardar logs de debug
async function saveDebugLog(
  userId: string,
  requestBody: any,
  responseBody: any,
  status: number,
  errorMessage?: string
) {
  try {
    await supabase.from('availability_debug_logs').insert({
      function_name: 'check-availability',
      user_id: userId,
      request_body: requestBody,
      response_body: responseBody,
      response_status: status,
      error_message: errorMessage || null
    });
  } catch (err) {
    console.error('[check-availability] Failed to save debug log:', err);
    // No rethrow - logging shouldn't break the main function
  }
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

  let requestBody: any;
  try {
    requestBody = await req.json();
    const { user_id, days_ahead = 10 } = requestBody;

    if (!user_id) {
      const errorResponse = { error: 'user_id is required' };
      await saveDebugLog('unknown', requestBody, errorResponse, 400, 'Missing user_id');
      return new Response(
        JSON.stringify(errorResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[check-availability] Checking for user ${user_id}, ${days_ahead} days ahead`);

    // Ya no necesitamos acceder a Google Calendar API - consultamos directo desde Supabase
    // La tabla calendar_events se sincroniza periódicamente con Google Calendar

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

    console.log(`[check-availability] Consultando eventos desde Supabase (calendar_events table)`);

    // Obtener eventos desde la tabla calendar_events (mucho más rápido que Google Calendar API)
    const { data: dbEvents, error: dbError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user_id)
      .gte('start_time', timeMin.toISOString())
      .lte('start_time', timeMax.toISOString())
      .eq('status', 'confirmed')
      .order('start_time', { ascending: true });

    if (dbError) {
      console.error('[check-availability] Database error:', dbError);
      const errorResponse = {
        error: 'Failed to fetch calendar events from database',
        config: null,
        occupied_events: []
      };
      await saveDebugLog(user_id, requestBody, errorResponse, 500, 'Database error');
      return new Response(
        JSON.stringify(errorResponse),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const events = dbEvents || [];
    console.log(`[check-availability] Encontrados ${events.length} eventos en la tabla`);

    // Formatear eventos ocupados con información legible
    const allFormattedEvents = events.map((event: any) => {
      const start = new Date(event.start_time);
      const end = new Date(event.end_time);

      return {
        id: event.google_event_id,
        title: event.summary || 'Sin título',
        start: start.toISOString(),
        end: end.toISOString(),
        start_local: start.toLocaleString('es-AR', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }),
        end_local: end.toLocaleString('es-AR', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }),
        date_local: start.toLocaleDateString('es-AR', { timeZone: timezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      };
    });

    // FILTRAR: Solo eventos dentro de work_hours
    const [workStartHour, workStartMin] = availableHoursStart.split(':').map(Number);
    const [workEndHour, workEndMin] = availableHoursEnd.split(':').map(Number);
    const workStartMinutes = workStartHour * 60 + workStartMin;
    const workEndMinutes = workEndHour * 60 + workEndMin;

    const formattedEvents = allFormattedEvents.filter((event) => {
      const [eventHour, eventMin] = event.start_local.split(':').map(Number);
      const eventMinutes = eventHour * 60 + eventMin;

      // Solo incluir si el evento empieza dentro de work_hours
      return eventMinutes >= workStartMinutes && eventMinutes < workEndMinutes;
    });

    console.log(`[check-availability] Found ${allFormattedEvents.length} total events, ${formattedEvents.length} within work_hours (${availableHoursStart}-${availableHoursEnd})`);

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

    // Respuesta estructurada simple para la IA
    const successResponse = {
      config: {
        current_datetime_local: currentDateTimeLocal,
        timezone: timezone,
        work_hours: {
          start: availableHoursStart,
          end: availableHoursEnd,
          days: availableDays
        },
        meeting_duration: duration
      },
      occupied_events: formattedEvents,
      total_events: formattedEvents.length
    };

    await saveDebugLog(user_id, requestBody, successResponse, 200);

    return new Response(
      JSON.stringify(successResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[check-availability] Error:', error);
    const errorResponse = {
      error: error instanceof Error ? error.message : 'Unknown error',
      occupied_events: [],
      total_events: 0
    };

    // Try to save log even on unexpected errors
    try {
      await saveDebugLog(
        requestBody?.user_id || 'unknown',
        requestBody || {},
        errorResponse,
        500,
        error instanceof Error ? error.message : 'Unknown error'
      );
    } catch (logError) {
      console.error('[check-availability] Failed to save error log:', logError);
    }

    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
