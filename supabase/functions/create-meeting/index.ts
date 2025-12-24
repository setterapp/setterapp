import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateMeetingRequest {
    conversationId: string
    leadName: string
    leadEmail?: string // email del lead para agregarlo como asistente
    leadPhone?: string // teléfono del lead (opcional)
    agentId?: string
    customDate?: string // ISO string, opcional para forzar una fecha específica
    customDuration?: number // minutos, opcional para override
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const body: CreateMeetingRequest = await req.json()
        console.log('[CreateMeeting] Received request body:', JSON.stringify(body))
        const { conversationId, leadName, leadEmail, leadPhone, agentId, customDate, customDuration } = body

        if (!conversationId || !leadName) {
            console.error('[CreateMeeting] Missing required fields:', { conversationId, leadName })
            return new Response(
                JSON.stringify({ error: 'conversationId and leadName are required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('[CreateMeeting] Lead info:', { leadName, leadEmail, leadPhone })

        console.log('[CreateMeeting] Creating meeting for conversation:', conversationId)

        // 1. Obtener información de la conversación
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .select('user_id, platform, agent_id')
            .eq('id', conversationId)
            .single()

        if (convError || !conversation) {
            throw new Error('Conversation not found')
        }

        const userId = conversation.user_id
        const effectiveAgentId = agentId || conversation.agent_id

        // 2. Obtener configuración del agente
        let agentConfig: any = null
        let agentName = 'Agente'

        if (effectiveAgentId) {
            const { data: agent } = await supabase
                .from('agents')
                .select('name, config')
                .eq('id', effectiveAgentId)
                .single()

            if (agent) {
                agentConfig = agent.config
                agentName = agent.name
            }
        }

        // 3. Verificar que el agente tenga configuración de reuniones habilitada
        console.log('[CreateMeeting] Agent config:', {
            enableMeetingScheduling: agentConfig?.enableMeetingScheduling,
            meetingDuration: agentConfig?.meetingDuration,
            meetingAvailableHoursStart: agentConfig?.meetingAvailableHoursStart,
            meetingAvailableHoursEnd: agentConfig?.meetingAvailableHoursEnd
        })

        if (!agentConfig?.enableMeetingScheduling) {
            console.warn('[CreateMeeting] Meeting scheduling disabled for agent')
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Meeting scheduling not enabled for this agent'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 4. Obtener integración de Google Calendar
        const { data: integration, error: intError } = await supabase
            .from('integrations')
            .select('config')
            .eq('user_id', userId)
            .eq('type', 'google_calendar')
            .eq('status', 'connected')
            .single()

        if (intError || !integration) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Google Calendar not connected'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const accessToken = integration.config?.provider_token

        if (!accessToken) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Google Calendar access token not found'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 5. Obtener el calendario primario
        const calendarsResponse = await fetch(
            'https://www.googleapis.com/calendar/v3/users/me/calendarList',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        )

        if (!calendarsResponse.ok) {
            throw new Error('Failed to fetch calendars')
        }

        const calendarsData = await calendarsResponse.json()
        const primaryCalendar = calendarsData.items?.find((cal: any) => cal.primary)

        if (!primaryCalendar) {
            throw new Error('Primary calendar not found')
        }

        const calendarId = primaryCalendar.id

        // 6. Encontrar slot disponible
        const duration = customDuration || agentConfig.meetingDuration || 30
        const bufferMinutes = agentConfig.meetingBufferMinutes || 15
        const availableHoursStart = agentConfig.meetingAvailableHoursStart || '09:00'
        const availableHoursEnd = agentConfig.meetingAvailableHoursEnd || '18:00'
        const availableDays = agentConfig.meetingAvailableDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

        let startTime: Date
        let endTime: Date

        if (customDate) {
            // Usar fecha personalizada si se proporciona
            startTime = new Date(customDate)

            if (isNaN(startTime.getTime())) {
                console.error('[CreateMeeting] Invalid date received:', customDate)
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: `Invalid date format: ${customDate}`
                    }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            console.log('[CreateMeeting] Using custom date:', startTime.toISOString())
            endTime = new Date(startTime.getTime() + duration * 60 * 1000)
        } else {
            // Buscar el próximo slot disponible
            const slot = await findNextAvailableSlot(
                calendarId,
                accessToken,
                duration,
                bufferMinutes,
                availableHoursStart,
                availableHoursEnd,
                availableDays
            )

            if (!slot) {
                console.warn('[CreateMeeting] No available slots found')
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: 'No available slots found in the next 7 days'
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            console.log('[CreateMeeting] Found slot:', slot)
            startTime = slot.start
            endTime = slot.end
        }

        // 7. Crear evento en Google Calendar
        const meetingTitle = (agentConfig.meetingTitle || 'Reunión con {nombre}')
            .replace('{nombre}', leadName)

        let meetingDescription = (agentConfig.meetingDescription || 'Reunión programada automáticamente')
            .replace('{nombre}', leadName)

        // Agregar información del lead a la descripción
        if (leadEmail) {
            meetingDescription += `\n\nEmail del lead: ${leadEmail}`
        }
        if (leadPhone) {
            meetingDescription += `\nTeléfono: ${leadPhone}`
        }

        // Preparar lista de asistentes
        const attendees = []

        // Agregar el email del lead si está disponible
        if (leadEmail) {
            attendees.push({ email: leadEmail })
            console.log('[CreateMeeting] Adding lead as attendee:', leadEmail)
        }

        // Agregar el email del agente si está configurado
        if (agentConfig.meetingEmail) {
            attendees.push({ email: agentConfig.meetingEmail })
            console.log('[CreateMeeting] Adding agent as attendee:', agentConfig.meetingEmail)
        }

        const eventResponse = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    summary: meetingTitle,
                    description: meetingDescription,
                    start: {
                        dateTime: startTime.toISOString(),
                        timeZone: 'America/Argentina/Buenos_Aires',
                    },
                    end: {
                        dateTime: endTime.toISOString(),
                        timeZone: 'America/Argentina/Buenos_Aires',
                    },
                    attendees: attendees.length > 0 ? attendees : undefined,
                    conferenceData: {
                        createRequest: {
                            requestId: `meet-${Date.now()}`,
                            conferenceSolutionKey: { type: 'hangoutsMeet' },
                        },
                    },
                    guestsCanModify: false,
                    guestsCanInviteOthers: false,
                    guestsCanSeeOtherGuests: true,
                }),
            }
        )

        if (!eventResponse.ok) {
            const errorData = await eventResponse.json()
            console.error('[CreateMeeting] Google Calendar API error:', errorData)
            throw new Error(`Failed to create event: ${JSON.stringify(errorData)}`)
        }

        const event = await eventResponse.json()
        const meetingLink = event.hangoutLink || event.htmlLink

        console.log('[CreateMeeting] ✅ Meeting created:', event.id)

        // 8. Guardar reunión en BD (opcional, para tracking)
        try {
            await supabase
                .from('meetings')
                .insert({
                    user_id: userId,
                    conversation_id: conversationId,
                    agent_id: effectiveAgentId,
                    calendar_event_id: event.id,
                    meeting_date: startTime.toISOString(),
                    duration_minutes: duration,
                    meeting_link: meetingLink,
                    lead_name: leadName,
                    lead_email: leadEmail || null,
                    lead_phone: leadPhone || null,
                    status: 'scheduled',
                    metadata: {
                        calendar_id: calendarId,
                        event_summary: event.summary,
                        agent_email: agentConfig.meetingEmail,
                        attendees_count: attendees.length,
                    },
                })
        } catch (dbError) {
            console.error('[CreateMeeting] Error guardando reunión en BD:', dbError)
            // No fallar si hay error en DB, la reunión ya está creada en Calendar
        }

        // 9. Enviar notificación al lead (llamar a la función desde el cliente)
        // Por ahora retornamos los datos necesarios para que el cliente llame al servicio de notificaciones

        return new Response(
            JSON.stringify({
                success: true,
                meeting: {
                    id: event.id,
                    date: startTime.toISOString(),
                    duration,
                    link: meetingLink,
                    title: meetingTitle,
                },
                notificationData: {
                    leadName,
                    meetingDate: startTime.toISOString(),
                    meetingLink,
                    duration,
                    agentName,
                },
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        console.error('[CreateMeeting] Error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

async function findNextAvailableSlot(
    calendarId: string,
    accessToken: string,
    duration: number,
    bufferMinutes: number,
    availableHoursStart: string,
    availableHoursEnd: string,
    availableDays: string[]
): Promise<{ start: Date; end: Date } | null> {
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

    const [startHour, startMinute] = availableHoursStart.split(':').map(Number)
    const [endHour, endMinute] = availableHoursEnd.split(':').map(Number)

    const now = new Date()
    const maxDaysAhead = 7

    for (let dayOffset = 0; dayOffset < maxDaysAhead; dayOffset++) {
        const checkDate = new Date(now)
        checkDate.setDate(checkDate.getDate() + dayOffset)
        checkDate.setHours(startHour, startMinute, 0, 0)

        const dayOfWeek = daysOfWeek[checkDate.getDay()]

        if (!availableDays.includes(dayOfWeek)) {
            continue
        }

        const dayStart = new Date(checkDate)
        const dayEnd = new Date(checkDate)
        dayEnd.setHours(endHour, endMinute, 0, 0)

        if (dayOffset === 0 && dayStart < now) {
            const minutesUntilNextSlot = Math.ceil((now.getTime() - dayStart.getTime()) / (60 * 1000))
            dayStart.setTime(dayStart.getTime() + minutesUntilNextSlot * 60 * 1000)
        }

        const eventsResponse = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
            `timeMin=${dayStart.toISOString()}&` +
            `timeMax=${dayEnd.toISOString()}&` +
            `singleEvents=true&` +
            `orderBy=startTime`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        )

        if (!eventsResponse.ok) {
            continue
        }

        const eventsData = await eventsResponse.json()
        const events = eventsData.items || []

        let currentTime = new Date(dayStart)

        while (currentTime < dayEnd) {
            const slotEnd = new Date(currentTime.getTime() + duration * 60 * 1000)

            if (slotEnd > dayEnd) {
                break
            }

            const hasConflict = events.some((event: any) => {
                const eventStart = new Date(event.start.dateTime || event.start.date)
                const eventEnd = new Date(event.end.dateTime || event.end.date)

                const slotStartWithBuffer = new Date(currentTime.getTime() - bufferMinutes * 60 * 1000)
                const slotEndWithBuffer = new Date(slotEnd.getTime() + bufferMinutes * 60 * 1000)

                return (
                    (slotStartWithBuffer < eventEnd && slotEndWithBuffer > eventStart) ||
                    (eventStart < slotEndWithBuffer && eventEnd > slotStartWithBuffer)
                )
            })

            if (!hasConflict) {
                return { start: currentTime, end: slotEnd }
            }

            currentTime = new Date(currentTime.getTime() + 15 * 60 * 1000)
        }
    }

    return null
}
