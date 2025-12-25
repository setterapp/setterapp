import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ScheduleMeetingRequest {
  user_id: string;
  conversation_id: string;
  agent_id?: string;
  meeting_date: string; // ISO 8601 format
  duration_minutes?: number; // Default: 30
  lead_name: string;
  lead_email?: string; // Optional para añadir como attendee
  meeting_title?: string; // Custom title
  meeting_description?: string; // Custom description
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

  console.log('[schedule-meeting] Token expired, refreshing...');

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

  console.log('[schedule-meeting] Token refreshed successfully');

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
    const body: ScheduleMeetingRequest = await req.json();
    const {
      user_id,
      conversation_id,
      agent_id,
      meeting_date,
      duration_minutes = 30,
      lead_name,
      lead_email,
      meeting_title,
      meeting_description
    } = body;

    // Validaciones
    if (!user_id || !conversation_id || !meeting_date || !lead_name) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: user_id, conversation_id, meeting_date, lead_name'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[schedule-meeting] Scheduling for user ${user_id}, lead ${lead_name} on ${meeting_date}`);

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
          error: 'Google Calendar not connected. Please connect your calendar first.'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener access token (y refrescar si es necesario)
    const accessToken = await refreshGoogleTokenIfNeeded(integration);

    if (!accessToken) {
      throw new Error('No access token available');
    }

    // Calcular fecha de inicio y fin
    const startDate = new Date(meeting_date);
    const endDate = new Date(startDate.getTime() + (duration_minutes * 60 * 1000));

    // Preparar evento de Google Calendar
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Argentina/Buenos_Aires';

    const calendarEvent = {
      summary: meeting_title || `Reunión con ${lead_name}`,
      description: meeting_description || `Reunión agendada automáticamente por el asistente de IA con ${lead_name}`,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: timeZone,
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: timeZone,
      },
      attendees: lead_email ? [{ email: lead_email }] : [],
      reminders: {
        useDefault: true,
      },
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      }
    };

    // Crear evento en Google Calendar con conferenceData
    const calendarResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(calendarEvent),
      }
    );

    if (!calendarResponse.ok) {
      const errorData = await calendarResponse.json().catch(() => ({}));
      console.error('[schedule-meeting] Calendar API error:', errorData);
      throw new Error(`Failed to create calendar event: ${errorData.error?.message || 'Unknown error'}`);
    }

    const createdEvent = await calendarResponse.json();
    const calendarEventId = createdEvent.id;

    console.log('[schedule-meeting] Initial event created', {
      eventId: createdEvent.id,
      conferenceDataStatus: createdEvent.conferenceData?.createRequest?.status || 'unknown',
      hasEntryPoints: !!createdEvent.conferenceData?.entryPoints
    });

    // El conferenceData puede estar en "pending" inicialmente
    // Esperamos y hacemos polling para obtener el link de Meet
    let meetingLink = createdEvent.htmlLink; // fallback al link del calendario
    let finalEvent = createdEvent;

    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
      if (finalEvent.conferenceData?.entryPoints) {
        const videoEntry = finalEvent.conferenceData.entryPoints.find((ep: any) => ep.entryPointType === 'video');
        if (videoEntry?.uri) {
          meetingLink = videoEntry.uri;
          console.log('[schedule-meeting] Google Meet link found', { meetingLink, attempt: i + 1 });
          break;
        }
      } else if (finalEvent.hangoutLink) {
        meetingLink = finalEvent.hangoutLink;
        console.log('[schedule-meeting] Hangout link found', { meetingLink, attempt: i + 1 });
        break;
      }

      // Si no encontramos el link y no es el último intento, esperamos y reintentamos
      if (i < maxRetries - 1) {
        console.log('[schedule-meeting] Conference data not ready, waiting...', { attempt: i + 1 });
        await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos

        // Obtener el evento actualizado
        const getResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${createdEvent.id}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            }
          }
        );

        if (getResponse.ok) {
          finalEvent = await getResponse.json();
          console.log('[schedule-meeting] Event refetched', {
            hasConferenceData: !!finalEvent.conferenceData,
            hasEntryPoints: !!finalEvent.conferenceData?.entryPoints
          });
        }
      }
    }

    console.log(`[schedule-meeting] Calendar event created: ${calendarEventId}, final meeting link: ${meetingLink}`);

    // Guardar en tabla meetings
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .insert({
        user_id,
        conversation_id,
        agent_id: agent_id || null,
        calendar_event_id: calendarEventId,
        meeting_date: startDate.toISOString(),
        duration_minutes,
        meeting_link: meetingLink,
        lead_name,
        status: 'scheduled',
        metadata: {
          lead_email,
          created_by: 'ai_agent',
          calendar_summary: calendarEvent.summary,
          calendar_description: calendarEvent.description,
        },
      })
      .select()
      .single();

    if (meetingError) {
      console.error('[schedule-meeting] DB error:', meetingError);
      // Intentar eliminar el evento de Google Calendar si falla la DB
      try {
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${calendarEventId}`,
          {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        );
      } catch (deleteError) {
        console.error('[schedule-meeting] Failed to rollback calendar event:', deleteError);
      }

      throw new Error(`Failed to save meeting to database: ${meetingError.message}`);
    }

    console.log(`[schedule-meeting] Meeting saved to DB: ${meeting.id}`);

    // Respuesta exitosa
    return new Response(
      JSON.stringify({
        success: true,
        meeting: {
          id: meeting.id,
          calendar_event_id: calendarEventId,
          meeting_date: startDate.toISOString(),
          duration_minutes,
          lead_name,
          meeting_link: meetingLink,
          status: 'scheduled',
        },
        message: `Reunión agendada exitosamente para ${startDate.toLocaleString('es-AR', {
          timeZone,
          dateStyle: 'full',
          timeStyle: 'short',
        })}`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[schedule-meeting] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
