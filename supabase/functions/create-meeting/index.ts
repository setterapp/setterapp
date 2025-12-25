import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createLogger } from '../_shared/logger.ts'

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
    checkAvailabilityOnly?: boolean // Nuevo flag para solo consultar disponibilidad
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const logger = createLogger('create-meeting')
    const debugLog: any[] = []

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const body: CreateMeetingRequest = await req.json()
        const { conversationId, leadName, leadEmail, leadPhone, agentId, customDate, customDuration, checkAvailabilityOnly } = body

        logger.info('Request received', {
            mode: checkAvailabilityOnly ? 'check_availability' : 'create_meeting',
            conversationId,
            leadName,
            leadEmail,
            leadPhone,
            customDate,
            customDuration
        })
        debugLog.push({ step: 'REQUEST', data: body })

        if (!conversationId || (!leadName && !checkAvailabilityOnly)) {
            logger.error('Missing required fields', { conversationId, leadName })
            debugLog.push({ step: 'VALIDATION_ERROR', error: 'Missing required fields' })
            return new Response(
                JSON.stringify({ error: 'conversationId is required', debug: debugLog }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 1. Obtener información de la conversación
        logger.step(1, 'Loading conversation')
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .select('user_id, platform, agent_id')
            .eq('id', conversationId)
            .single()

        if (convError || !conversation) {
            logger.error('Conversation not found', { conversationId, error: convError })
            debugLog.push({ step: 'CONVERSATION_ERROR', error: convError })
            throw new Error('Conversation not found')
        }

        const userId = conversation.user_id
        const effectiveAgentId = agentId || conversation.agent_id

        logger.success('Conversation loaded', { userId, agentId: effectiveAgentId })
        debugLog.push({ step: 'CONVERSATION_LOADED', data: { userId, agentId: effectiveAgentId } })

        // 2. Obtener configuración del agente
        logger.step(2, 'Loading agent configuration')
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
                logger.success('Agent loaded', { name: agentName, hasConfig: !!agentConfig })
                debugLog.push({
                    step: 'AGENT_LOADED',
                    data: {
                        name: agentName,
                        enableMeetingScheduling: agentConfig?.enableMeetingScheduling,
                        meetingDuration: agentConfig?.meetingDuration,
                        meetingBufferMinutes: agentConfig?.meetingBufferMinutes,
                        availableHoursStart: agentConfig?.meetingAvailableHoursStart,
                        availableHoursEnd: agentConfig?.meetingAvailableHoursEnd,
                        availableDays: agentConfig?.meetingAvailableDays
                    }
                })
            }
        }

        if (!agentConfig?.enableMeetingScheduling) {
            logger.warn('Meeting scheduling not enabled for this agent')
            debugLog.push({ step: 'CONFIG_ERROR', error: 'Meeting scheduling not enabled' })
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Meeting scheduling not enabled for this agent',
                    debug: debugLog
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Obtener token de Google Calendar
        logger.step(3, 'Loading Google Calendar integration')
        const { data: integration, error: intError } = await supabase
            .from('integrations')
            .select('config')
            .eq('user_id', userId)
            .eq('type', 'google_calendar')
            .eq('status', 'connected')
            .single()

        if (intError || !integration || !integration.config?.provider_token) {
            logger.error('Google Calendar not connected', { intError })
            debugLog.push({ step: 'INTEGRATION_ERROR', error: 'Google Calendar not connected or missing token' })
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Google Calendar not connected or missing token',
                    debug: debugLog
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        logger.success('Google Calendar integration found')
        debugLog.push({ step: 'INTEGRATION_LOADED', data: { hasToken: !!integration.config.provider_token } })

        const accessToken = integration.config.provider_token
        const calendarId = 'primary'

        const duration = customDuration || agentConfig.meetingDuration || 30
        const bufferMinutes = agentConfig.meetingBufferMinutes || 0
        const availableHoursStart = agentConfig.meetingAvailableHoursStart || '09:00'
        const availableHoursEnd = agentConfig.meetingAvailableHoursEnd || '18:00'
        const availableDays = agentConfig.meetingAvailableDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        const timezone = agentConfig.meetingTimezone || 'Europe/Madrid'

        logger.info('Meeting configuration', {
            duration,
            bufferMinutes,
            availableHoursStart,
            availableHoursEnd,
            availableDays,
            timezone
        })
        debugLog.push({
            step: 'MEETING_CONFIG',
            data: { duration, bufferMinutes, availableHoursStart, availableHoursEnd, availableDays, timezone }
        })


        // --- MODE: CHECK AVAILABILITY ---
        if (checkAvailabilityOnly) {
            logger.step(4, 'Checking availability (Parallelized)')
            debugLog.push({ step: 'AVAILABILITY_CHECK_START', data: { mode: 'parallel' } })

            try {
                const slots = await findAllAvailableSlots(
                    calendarId,
                    accessToken,
                    duration,
                    bufferMinutes,
                    availableHoursStart,
                    availableHoursEnd,
                    availableDays,
                    logger,
                    debugLog
                )

                logger.success(`Found ${slots.length} available slots`, { count: slots.length })
                debugLog.push({ step: 'AVAILABILITY_CHECK_COMPLETE', data: { slotsFound: slots.length, slots } })

                logger.summary(true, { slotsFound: slots.length })

                return new Response(
                    JSON.stringify({
                        success: true,
                        slots: slots,
                        debug: debugLog,
                        executionTime: logger.getDuration()
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            } catch (err) {
                logger.error('Error checking availability', { error: err.message }, err)
                debugLog.push({ step: 'AVAILABILITY_CHECK_ERROR', error: err.message })
                logger.summary(false, { error: err.message })
                return new Response(
                    JSON.stringify({ success: false, error: err.message, debug: debugLog }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        // --- MODE: CREATE MEETING ---
        logger.step(4, 'Scheduling meeting')
        debugLog.push({ step: 'CREATE_MEETING_START' })

        let startTime: Date
        let endTime: Date

        if (customDate) {
            startTime = new Date(customDate)
            if (isNaN(startTime.getTime())) {
                logger.error('Invalid date format', { customDate })
                debugLog.push({ step: 'INVALID_DATE', error: 'Invalid date format', customDate })
                throw new Error(`Invalid date format: ${customDate}`)
            }
            endTime = new Date(startTime.getTime() + duration * 60 * 1000)
            logger.info('Using provided custom date', { startTime: startTime.toISOString() })
            debugLog.push({ step: 'USING_CUSTOM_DATE', data: { startTime: startTime.toISOString(), endTime: endTime.toISOString() } })
        } else {
            // Fallback: Find first available slot
            logger.info('Finding first available slot')
            debugLog.push({ step: 'FINDING_SLOT' })
            const slots = await findAllAvailableSlots(
                calendarId,
                accessToken,
                duration,
                bufferMinutes,
                availableHoursStart,
                availableHoursEnd,
                availableDays,
                logger,
                debugLog,
                3 // Reduced scope for quick check
            )
            if (slots.length === 0) {
                logger.error('No available slots found')
                debugLog.push({ step: 'NO_SLOTS_FOUND' })
                logger.summary(false, { error: 'No available slots' })
                return new Response(
                    JSON.stringify({ success: false, error: 'No available slots found', debug: debugLog }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
            startTime = new Date(slots[0].start)
            endTime = new Date(slots[0].end)
            logger.success('Found next available slot', { startTime: startTime.toISOString() })
            debugLog.push({ step: 'SLOT_FOUND', data: { startTime: startTime.toISOString(), endTime: endTime.toISOString() } })
        }

        // Crear evento (Google Calendar API...)
        logger.step(5, 'Creating Google Calendar event')
        const meetingTitle = (agentConfig.meetingTitle || 'Reunión con {nombre}').replace('{nombre}', leadName)
        let meetingDescription = (agentConfig.meetingDescription || 'Reunión programada automáticamente').replace('{nombre}', leadName)

        if (leadEmail) meetingDescription += `\n\nEmail del lead: ${leadEmail}`
        if (leadPhone) meetingDescription += `\nTeléfono: ${leadPhone}`

        const attendees = []
        if (leadEmail) attendees.push({ email: leadEmail })
        if (agentConfig.meetingEmail) attendees.push({ email: agentConfig.meetingEmail })

        debugLog.push({
            step: 'CREATING_CALENDAR_EVENT',
            data: {
                title: meetingTitle,
                attendees: attendees.map(a => a.email),
                start: startTime.toISOString(),
                end: endTime.toISOString()
            }
        })

        const eventResponse = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    summary: meetingTitle,
                    description: meetingDescription,
                    start: { dateTime: startTime.toISOString(), timeZone: timezone },
                    end: { dateTime: endTime.toISOString(), timeZone: timezone },
                    attendees: attendees.length > 0 ? attendees : undefined,
                    conferenceData: {
                        createRequest: { requestId: `meet-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } },
                    },
                    guestsCanModify: false,
                    guestsCanInviteOthers: false,
                    guestsCanSeeOtherGuests: true,
                }),
            }
        )

        if (!eventResponse.ok) {
            const errBody = await eventResponse.text()
            logger.error('Google Calendar API error', { status: eventResponse.status, statusText: eventResponse.statusText, body: errBody })
            debugLog.push({ step: 'CALENDAR_API_ERROR', error: { status: eventResponse.status, body: errBody } })
            throw new Error(`Failed to create event: ${eventResponse.statusText}`)
        }

        const event = await eventResponse.json()

        logger.info('Initial event created', {
            eventId: event.id,
            conferenceDataStatus: event.conferenceData?.createRequest?.status || 'unknown',
            hasEntryPoints: !!event.conferenceData?.entryPoints
        })

        // El conferenceData puede estar en "pending" inicialmente
        // Esperamos y hacemos polling para obtener el link de Meet
        let meetingLink = event.htmlLink // fallback al link del calendario
        let finalEvent = event

        const maxRetries = 3
        for (let i = 0; i < maxRetries; i++) {
            if (finalEvent.conferenceData?.entryPoints) {
                const videoEntry = finalEvent.conferenceData.entryPoints.find((ep: any) => ep.entryPointType === 'video')
                if (videoEntry?.uri) {
                    meetingLink = videoEntry.uri
                    logger.success('Google Meet link found', { meetingLink, attempt: i + 1 })
                    break
                }
            } else if (finalEvent.hangoutLink) {
                meetingLink = finalEvent.hangoutLink
                logger.success('Hangout link found', { meetingLink, attempt: i + 1 })
                break
            }

            // Si no encontramos el link y no es el último intento, esperamos y reintentamos
            if (i < maxRetries - 1) {
                logger.info('Conference data not ready, waiting...', { attempt: i + 1 })
                await new Promise(resolve => setTimeout(resolve, 2000)) // Esperar 2 segundos

                // Obtener el evento actualizado
                const getResponse = await fetch(
                    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.id}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                        }
                    }
                )

                if (getResponse.ok) {
                    finalEvent = await getResponse.json()
                    logger.info('Event refetched', {
                        hasConferenceData: !!finalEvent.conferenceData,
                        hasEntryPoints: !!finalEvent.conferenceData?.entryPoints
                    })
                }
            }
        }

        logger.success('Google Calendar event created', { eventId: event.id, meetingLink, hasConferenceData: !!finalEvent.conferenceData })
        debugLog.push({
            step: 'CALENDAR_EVENT_CREATED',
            data: {
                eventId: event.id,
                meetingLink,
                conferenceData: finalEvent.conferenceData ? 'present' : 'missing',
                entryPoints: finalEvent.conferenceData?.entryPoints || 'missing',
                hangoutLink: finalEvent.hangoutLink || 'missing'
            }
        })

        // Guardar en BD (Best effort)
        logger.step(6, 'Saving meeting to database')
        try {
            await supabase.from('meetings').insert({
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
                metadata: { agent_email: agentConfig.meetingEmail }
            })
            logger.success('Meeting saved to database')
            debugLog.push({ step: 'DB_SAVED', success: true })
        } catch (e) {
            logger.error('Database save error', { error: e.message }, e)
            debugLog.push({ step: 'DB_SAVE_ERROR', error: e.message })
        }

        logger.summary(true, { eventId: event.id, meetingLink })

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
                debug: debugLog,
                executionTime: logger.getDuration()
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        logger.error('Critical error in create-meeting function', { error: error.message }, error)
        debugLog.push({ step: 'CRITICAL_ERROR', error: error.message, stack: error.stack })
        logger.summary(false, { error: error.message })
        return new Response(
            JSON.stringify({ success: false, error: error.message, debug: debugLog, executionTime: logger.getDuration() }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

async function findAllAvailableSlots(
    calendarId: string,
    accessToken: string,
    duration: number,
    bufferMinutes: number,
    availableHoursStart: string,
    availableHoursEnd: string,
    availableDays: string[],
    logger: any,
    debugLog: any[],
    daysScope: number = 5
): Promise<Array<{ start: string; end: string }>> {
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const [startHour, startMinute] = availableHoursStart.split(':').map(Number)
    const [endHour, endMinute] = availableHoursEnd.split(':').map(Number)

    const now = new Date()
    now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0)

    logger.info('Scanning availability', {
        daysScope,
        duration,
        bufferMinutes,
        startingFrom: now.toISOString(),
        availableDays
    })
    debugLog.push({
        step: 'SCANNING_AVAILABILITY',
        data: { daysScope, duration, bufferMinutes, startingFrom: now.toISOString(), availableDays }
    })

    const promises = []

    for (let dayOffset = 0; dayOffset < daysScope; dayOffset++) {
        promises.push((async () => {
            const checkDate = new Date(now)
            checkDate.setDate(checkDate.getDate() + dayOffset)

            const dayName = daysOfWeek[checkDate.getDay()]
            if (!availableDays.includes(dayName)) return []

            const workStart = new Date(checkDate)
            workStart.setHours(startHour, startMinute, 0, 0)

            const workEnd = new Date(checkDate)
            workEnd.setHours(endHour, endMinute, 0, 0)

            let currentTime = new Date(workStart)
            if (currentTime < now) {
                currentTime = new Date(now)
            }

            if (currentTime >= workEnd) return []

            const eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
                `timeMin=${workStart.toISOString()}&` +
                `timeMax=${workEnd.toISOString()}&` +
                `singleEvents=true&` +
                `orderBy=startTime`

            const eventsRes = await fetch(eventsUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            })

            if (!eventsRes.ok) {
                const errorMsg = `Google API Error for ${checkDate.toISOString().split('T')[0]}: ${eventsRes.status} ${eventsRes.statusText}`
                logger.error(errorMsg, { date: checkDate.toISOString().split('T')[0], status: eventsRes.status })
                debugLog.push({
                    step: 'GOOGLE_API_ERROR',
                    error: errorMsg,
                    date: checkDate.toISOString().split('T')[0],
                    status: eventsRes.status
                })
                if (eventsRes.status === 401) throw new Error('Google Calendar Token Expired')
                return []
            }

            const eventsData = await eventsRes.json()
            const events = eventsData.items || []
            logger.debug(`Checking day ${checkDate.toISOString().split('T')[0]}`, { existingEvents: events.length })
            const daySlots = []

            while (currentTime.getTime() + duration * 60000 <= workEnd.getTime()) {
                const slotStart = new Date(currentTime)
                const slotEnd = new Date(currentTime.getTime() + duration * 60000)

                const hasConflict = events.some((event: any) => {
                    const evStart = new Date(event.start.dateTime || event.start.date)
                    const evEnd = new Date(event.end.dateTime || event.end.date)
                    const bufStart = new Date(slotStart.getTime() - bufferMinutes * 60000)
                    const bufEnd = new Date(slotEnd.getTime() + bufferMinutes * 60000)
                    return (bufStart < evEnd && bufEnd > evStart)
                })

                if (!hasConflict) {
                    daySlots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() })
                    if (daySlots.length >= 8) break // Limit slots per day
                }
                currentTime = new Date(currentTime.getTime() + 30 * 60000)
            }
            return daySlots
        })())
    }

    const results = await Promise.all(promises)
    const allSlots = results.flat().slice(0, 20) // Limit total returned slots to prevent large JSON

    logger.info('Availability scan complete', { totalSlots: allSlots.length, daysScanned: daysScope })
    debugLog.push({
        step: 'SCAN_COMPLETE',
        data: { totalSlots: allSlots.length, daysScanned: daysScope }
    })

    return allSlots
}

async function findNextAvailableSlot(
    calendarId: string,
    accessToken: string,
    duration: number,
    bufferMinutes: number,
    availableHoursStart: string,
    availableHoursEnd: string,
    availableDays: string[]
): Promise<{ start: Date; end: Date } | null> {
    const slots = await findAllAvailableSlots(calendarId, accessToken, duration, bufferMinutes, availableHoursStart, availableHoursEnd, availableDays, 5)
    if (slots.length > 0) {
        return { start: new Date(slots[0].start), end: new Date(slots[0].end) }
    }
    return null
}
