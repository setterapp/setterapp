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

// Helper para guardar logs de debug
async function saveDebugLog(
  userId: string,
  conversationId: string | undefined,
  requestBody: any,
  responseBody: any,
  status: number,
  errorMessage?: string
) {
  try {
    await supabase.from('availability_debug_logs').insert({
      function_name: 'schedule-meeting',
      user_id: userId,
      conversation_id: conversationId || null,
      request_body: requestBody,
      response_body: responseBody,
      response_status: status,
      error_message: errorMessage || null
    });
  } catch (err) {
    console.error('[schedule-meeting] Failed to save debug log:', err);
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
    } = requestBody;

    // Validaciones
    if (!user_id || !conversation_id || !meeting_date || !lead_name) {
      const errorResponse = {
        error: 'Missing required fields: user_id, conversation_id, meeting_date, lead_name'
      };
      await saveDebugLog(user_id || 'unknown', conversation_id, requestBody, errorResponse, 400, 'Missing required fields');
      return new Response(
        JSON.stringify(errorResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[schedule-meeting] === INICIO ===`);
    console.log(`[schedule-meeting] Input recibido de la IA:`, {
      user_id,
      conversation_id,
      meeting_date,
      duration_minutes,
      lead_name,
      lead_email: lead_email || 'no proporcionado'
    });

    // Obtener integración de Google Calendar
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('type', 'google-calendar')
      .eq('user_id', user_id)
      .eq('status', 'connected')
      .single();

    if (integrationError || !integration) {
      const errorResponse = {
        error: 'Google Calendar not connected. Please connect your calendar first.'
      };
      await saveDebugLog(user_id, conversation_id, requestBody, errorResponse, 400, 'Google Calendar not connected');
      return new Response(
        JSON.stringify(errorResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener access token (y refrescar si es necesario)
    const accessToken = await refreshGoogleTokenIfNeeded(integration);

    if (!accessToken) {
      throw new Error('No access token available');
    }

    // Obtener timezone del agente (buscar Instagram o WhatsApp)
    const { data: agent } = await supabase
      .from('agents')
      .select('config')
      .eq('user_id', user_id)
      .in('platform', ['instagram', 'whatsapp'])
      .limit(1)
      .maybeSingle();

    const timeZone = agent?.config?.meetingTimezone || 'America/Argentina/Buenos_Aires';
    const availableHoursStart = agent?.config?.meetingAvailableHoursStart || '09:00';
    const availableHoursEnd = agent?.config?.meetingAvailableHoursEnd || '18:00';

    // Calcular fecha de inicio y fin
    const startDate = new Date(meeting_date);
    const endDate = new Date(startDate.getTime() + (duration_minutes * 60 * 1000));

    console.log(`[schedule-meeting] 📅 Fecha propuesta:`, {
      meeting_date_iso: meeting_date,
      startDate_parsed: startDate.toISOString(),
      timezone: timeZone
    });

    // VALIDACIÓN: Verificar que esté dentro de work_hours
    const startHourLocal = startDate.toLocaleString('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const [workStartHour, workStartMin] = availableHoursStart.split(':').map(Number);
    const [workEndHour, workEndMin] = availableHoursEnd.split(':').map(Number);
    const [proposedHour, proposedMin] = startHourLocal.split(':').map(Number);

    const proposedMinutes = proposedHour * 60 + proposedMin;
    const workStartMinutes = workStartHour * 60 + workStartMin;
    const workEndMinutes = workEndHour * 60 + workEndMin;

    console.log(`[schedule-meeting] ⏰ VALIDACIÓN HORARIO:`, {
      horario_propuesto: startHourLocal,
      horario_laboral: `${availableHoursStart}-${availableHoursEnd}`,
      proposedMinutes,
      workStartMinutes,
      workEndMinutes,
      es_valido: proposedMinutes >= workStartMinutes && proposedMinutes < workEndMinutes
    });

    if (proposedMinutes < workStartMinutes || proposedMinutes >= workEndMinutes) {
      const errorResponse = {
        error: `Horario fuera de rango. La reunión está propuesta para ${startHourLocal} pero el horario laboral es ${availableHoursStart}-${availableHoursEnd}. DEBES proponer un horario dentro de este rango.`,
        success: false,
        valid_hours: `${availableHoursStart}-${availableHoursEnd}`
      };
      console.log(`[schedule-meeting] ❌ RECHAZADO - Horario fuera de rango:`, {
        propuesto: startHourLocal,
        valido: `${availableHoursStart}-${availableHoursEnd}`
      });
      await saveDebugLog(user_id, conversation_id, requestBody, errorResponse, 400, 'Outside work hours');
      return new Response(
        JSON.stringify(errorResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

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

    console.log('[schedule-meeting] ✅ Evento creado en Google Calendar:', {
      eventId: createdEvent.id,
      htmlLink: createdEvent.htmlLink,
      conferenceDataStatus: createdEvent.conferenceData?.createRequest?.status || 'unknown',
      hasEntryPoints: !!createdEvent.conferenceData?.entryPoints
    });

    // El conferenceData puede estar en "pending" inicialmente
    // Esperamos y hacemos polling para obtener el link de Meet
    let meetingLink = ''; // No usar fallback inmediatamente
    let finalEvent = createdEvent;

    const maxRetries = 5; // Aumentado de 3 a 5
    for (let i = 0; i < maxRetries; i++) {
      // Intentar obtener el link de Meet de varias formas
      if (finalEvent.conferenceData?.entryPoints) {
        const videoEntry = finalEvent.conferenceData.entryPoints.find((ep: any) => ep.entryPointType === 'video');
        if (videoEntry?.uri) {
          meetingLink = videoEntry.uri;
          console.log('[schedule-meeting] ✅ Google Meet link found via entryPoints', { meetingLink, attempt: i + 1 });
          break;
        }
      }

      if (finalEvent.hangoutLink) {
        meetingLink = finalEvent.hangoutLink;
        console.log('[schedule-meeting] ✅ Google Meet link found via hangoutLink', { meetingLink, attempt: i + 1 });
        break;
      }

      // Si no encontramos el link y no es el último intento, esperamos y reintentamos
      if (i < maxRetries - 1) {
        const waitTime = (i + 1) * 1500; // 1.5s, 3s, 4.5s, 6s (incrementando)
        console.log('[schedule-meeting] ⏳ Conference data not ready, waiting...', { attempt: i + 1, waitMs: waitTime });
        await new Promise(resolve => setTimeout(resolve, waitTime));

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
            hasEntryPoints: !!finalEvent.conferenceData?.entryPoints,
            hasHangoutLink: !!finalEvent.hangoutLink
          });
        }
      }
    }

    // Si después de todos los intentos no tenemos link de Meet, usar el link de Calendar como fallback
    if (!meetingLink) {
      meetingLink = createdEvent.htmlLink;
      console.log('[schedule-meeting] ⚠️ Meet link not available, using Calendar link as fallback:', meetingLink);
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

    // También guardar en calendar_events para sincronización inmediata
    // (no necesitamos esperar el webhook de Google Calendar)
    try {
      await supabase
        .from('calendar_events')
        .upsert({
          user_id: user_id,
          google_event_id: calendarEventId,
          summary: calendarEvent.summary,
          description: calendarEvent.description || null,
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          is_all_day: false,
          status: 'confirmed',
          last_synced_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,google_event_id',
          ignoreDuplicates: false,
        });

      console.log(`[schedule-meeting] Event also saved to calendar_events for instant availability`);
    } catch (calendarEventError) {
      console.error('[schedule-meeting] Failed to save to calendar_events (non-critical):', calendarEventError);
      // No es crítico - el webhook lo sincronizará eventualmente
    }

    // Actualizar el contacto con el email del lead
    if (lead_email && conversation_id) {
      try {
        // Primero obtener el contact_id de la conversación
        const { data: conversation } = await supabase
          .from('conversations')
          .select('contact_id')
          .eq('id', conversation_id)
          .single();

        if (conversation?.contact_id) {
          // Actualizar el contacto con el email
          await supabase
            .from('contacts')
            .update({
              email: lead_email,
              updated_at: new Date().toISOString()
            })
            .eq('id', conversation.contact_id);

          console.log(`[schedule-meeting] ✅ Contact updated with email: ${lead_email}`);
        } else {
          console.warn('[schedule-meeting] ⚠️ No contact_id found in conversation');
        }
      } catch (contactUpdateError) {
        console.error('[schedule-meeting] Failed to update contact email (non-critical):', contactUpdateError);
        // No es crítico - el email se guardó en meetings.metadata
      }
    }

    // Respuesta exitosa
    const successResponse = {
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
    };

    console.log(`[schedule-meeting] 🎉 SUCCESS - Respuesta que se enviará a la IA:`, successResponse);

    await saveDebugLog(user_id, conversation_id, requestBody, successResponse, 200);

    return new Response(
      JSON.stringify(successResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[schedule-meeting] ❌ ERROR GENERAL:', error);
    console.error('[schedule-meeting] Error stack:', error instanceof Error ? error.stack : 'No stack');
    const errorResponse = {
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false,
    };

    console.log(`[schedule-meeting] 💥 ERROR - Respuesta que se enviará a la IA:`, errorResponse);

    // Try to save log even on unexpected errors
    try {
      await saveDebugLog(
        requestBody?.user_id || 'unknown',
        requestBody?.conversation_id,
        requestBody || {},
        errorResponse,
        500,
        error instanceof Error ? error.message : 'Unknown error'
      );
    } catch (logError) {
      console.error('[schedule-meeting] Failed to save error log:', logError);
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
