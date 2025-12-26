import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CheckAvailabilityRequest {
  user_id: string;
  days_ahead?: number;
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

  let requestBody: CheckAvailabilityRequest | null = null;

  try {
    requestBody = await req.json();
    const { user_id, days_ahead = 10 } = requestBody!;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[check-availability] Checking for user ${user_id}, ${days_ahead} days ahead`);

    // Get agent config (try Instagram first, then WhatsApp)
    let agentConfig: any = {};
    const { data: agent } = await supabase
      .from('agents')
      .select('config')
      .eq('user_id', user_id)
      .in('platform', ['instagram', 'whatsapp'])
      .limit(1)
      .maybeSingle();

    if (agent?.config) {
      agentConfig = agent.config;
    }

    // Configuration with sensible defaults
    const duration = agentConfig.meetingDuration || 30;
    const availableHoursStart = agentConfig.meetingAvailableHoursStart || '09:00';
    const availableHoursEnd = agentConfig.meetingAvailableHoursEnd || '18:00';
    const availableDays = agentConfig.meetingAvailableDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const timezone = agentConfig.meetingTimezone || 'America/Argentina/Buenos_Aires';

    // Calculate date range
    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setHours(0, 0, 0, 0);

    const timeMax = new Date(now);
    timeMax.setDate(timeMax.getDate() + days_ahead);
    timeMax.setHours(23, 59, 59, 999);

    // Get events from calendar_events table (synced from Google Calendar)
    const { data: dbEvents, error: dbError } = await supabase
      .from('calendar_events')
      .select('google_event_id, summary, start_time, end_time')
      .eq('user_id', user_id)
      .gte('start_time', timeMin.toISOString())
      .lte('start_time', timeMax.toISOString())
      .eq('status', 'confirmed')
      .order('start_time', { ascending: true });

    if (dbError) {
      console.error('[check-availability] Database error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch calendar events', config: null, occupied_events: [] }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const events = dbEvents || [];
    console.log(`[check-availability] Found ${events.length} events`);

    // Format events for AI
    const [workStartHour, workStartMin] = availableHoursStart.split(':').map(Number);
    const [workEndHour, workEndMin] = availableHoursEnd.split(':').map(Number);
    const workStartMinutes = workStartHour * 60 + workStartMin;
    const workEndMinutes = workEndHour * 60 + workEndMin;

    const formattedEvents = events
      .map((event: any) => {
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
      })
      .filter((event) => {
        // Only include events within work hours
        const [eventHour, eventMin] = event.start_local.split(':').map(Number);
        const eventMinutes = eventHour * 60 + eventMin;
        return eventMinutes >= workStartMinutes && eventMinutes < workEndMinutes;
      });

    // Current datetime for AI context
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
        config: {
          current_datetime_local: currentDateTimeLocal,
          timezone: timezone,
          work_hours: { start: availableHoursStart, end: availableHoursEnd, days: availableDays },
          meeting_duration: duration
        },
        occupied_events: formattedEvents,
        total_events: formattedEvents.length
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[check-availability] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', occupied_events: [], total_events: 0 }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
