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

    // Calcular slots disponibles usando misma lógica que create-meeting
    const availableSlots = await findAvailableSlots(
      accessToken,
      duration,
      bufferMinutes,
      availableHoursStart,
      availableHoursEnd,
      availableDays,
      timezone,
      days_ahead
    );

    console.log(`[check-availability] Found ${availableSlots.length} available slots`);

    return new Response(
      JSON.stringify({
        available_slots: availableSlots,
        total_slots: availableSlots.length,
        timezone: timezone,
        duration_minutes: duration,
        work_hours: {
          start: availableHoursStart,
          end: availableHoursEnd,
          days: availableDays
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
        available_slots: [],
        total_slots: 0
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});

// Función para encontrar slots disponibles (misma lógica que create-meeting)
async function findAvailableSlots(
  accessToken: string,
  duration: number,
  bufferMinutes: number,
  availableHoursStart: string,
  availableHoursEnd: string,
  availableDays: string[],
  timezone: string,
  daysScope: number
): Promise<Array<{ start: string; end: string; date: string; time: string }>> {
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const [startHour, startMinute] = availableHoursStart.split(':').map(Number);
  const [endHour, endMinute] = availableHoursEnd.split(':').map(Number);

  // Usar fecha actual en el timezone del agente
  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0);

  const allSlots = [];

  for (let dayOffset = 0; dayOffset < daysScope; dayOffset++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + dayOffset);

    const dayName = daysOfWeek[checkDate.getDay()];
    if (!availableDays.includes(dayName)) continue;

    const workStart = new Date(checkDate);
    workStart.setHours(startHour, startMinute, 0, 0);

    const workEnd = new Date(checkDate);
    workEnd.setHours(endHour, endMinute, 0, 0);

    let currentTime = new Date(workStart);
    if (currentTime < now) {
      currentTime = new Date(now);
    }

    if (currentTime >= workEnd) continue;

    // Obtener eventos del día
    const eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${workStart.toISOString()}&` +
      `timeMax=${workEnd.toISOString()}&` +
      `singleEvents=true&` +
      `orderBy=startTime`;

    const eventsRes = await fetch(eventsUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!eventsRes.ok) {
      console.error(`[check-availability] Google API Error for ${checkDate.toISOString().split('T')[0]}`);
      continue;
    }

    const eventsData = await eventsRes.json();
    const events = eventsData.items || [];

    // Generar slots disponibles
    while (currentTime.getTime() + duration * 60000 <= workEnd.getTime()) {
      const slotStart = new Date(currentTime);
      const slotEnd = new Date(currentTime.getTime() + duration * 60000);

      const hasConflict = events.some((event: any) => {
        const evStart = new Date(event.start.dateTime || event.start.date);
        const evEnd = new Date(event.end.dateTime || event.end.date);
        const bufStart = new Date(slotStart.getTime() - bufferMinutes * 60000);
        const bufEnd = new Date(slotEnd.getTime() + bufferMinutes * 60000);
        return (bufStart < evEnd && bufEnd > evStart);
      });

      if (!hasConflict) {
        // Formatear para que sea fácil de leer por la IA
        const dateStr = slotStart.toLocaleDateString('es-AR', {
          timeZone: timezone,
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        const timeStr = slotStart.toLocaleTimeString('es-AR', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });

        allSlots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          date: dateStr,
          time: timeStr
        });

        if (allSlots.length >= 20) break; // Limitar a 20 slots totales
      }
      currentTime = new Date(currentTime.getTime() + 30 * 60000);
    }

    if (allSlots.length >= 20) break;
  }

  return allSlots;
}
