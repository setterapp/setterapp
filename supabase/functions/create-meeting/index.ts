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
    checkAvailabilityOnly?: boolean // Nuevo flag para solo consultar disponibilidad
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
        const { conversationId, leadName, leadEmail, leadPhone, agentId, customDate, customDuration, checkAvailabilityOnly } = body

        console.log('[CreateMeeting] Request:', {
            mode: checkAvailabilityOnly ? 'check_availability' : 'create_meeting',
            conversationId,
            leadName
        })

        if (!conversationId || (!leadName && !checkAvailabilityOnly)) {
            // leadName is required for creation, but might be optional for checkAvailability if we just want slots for an agent?
            // actually, let's keep it robust.
            console.error('[CreateMeeting] Missing required fields')
            return new Response(
                JSON.stringify({ error: 'conversationId is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

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

        if (!agentConfig?.enableMeetingScheduling) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Meeting scheduling not enabled for this agent'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Obtener token de Google Calendar
        const { data: integration, error: intError } = await supabase
            .from('integrations')
            .select('config')
            .eq('user_id', userId)
            .eq('type', 'google_calendar')
            .eq('status', 'connected')
            .single()

        if (intError || !integration || !integration.config?.provider_token) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Google Calendar not connected or missing token'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const accessToken = integration.config.provider_token
        const calendarId = 'primary' // Simplification, usually 'primary' works

        const duration = customDuration || agentConfig.meetingDuration || 30
        const bufferMinutes = agentConfig.meetingBufferMinutes || 0
        const availableHoursStart = agentConfig.meetingAvailableHoursStart || '09:00'
        const availableHoursEnd = agentConfig.meetingAvailableHoursEnd || '18:00'
        const availableDays = agentConfig.meetingAvailableDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']


        // --- MODE: CHECK AVAILABILITY ---
        if (checkAvailabilityOnly) {
            console.log('[CreateMeeting] Step 4: Checking availability (Parallelized)...')
            try {
                const slots = await findAllAvailableSlots(
                    calendarId,
                    accessToken,
                    duration,
                    bufferMinutes,
                    availableHoursStart,
                    availableHoursEnd,
                    availableDays
                )

                console.log(`[CreateMeeting] Step 5: Found ${slots.length} available slots`)

                return new Response(
                    JSON.stringify({
                        success: true,
                        slots: slots
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            } catch (err) {
                console.error('[CreateMeeting] Error in check logic:', err)
                // Return specific error to help diagnosis
                return new Response(
                    JSON.stringify({ success: false, error: err.message }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        // --- MODE: CREATE MEETING ---

        let startTime: Date
        let endTime: Date

        if (customDate) {
            startTime = new Date(customDate)
            if (isNaN(startTime.getTime())) {
                throw new Error(`Invalid date format: ${customDate}`)
            }
            endTime = new Date(startTime.getTime() + duration * 60 * 1000)
            console.log('[CreateMeeting] Using provided custom date:', startTime.toISOString())
        } else {
            // Fallback: Find first available slot
            const slots = await findAllAvailableSlots(
                calendarId,
                accessToken,
                duration,
                bufferMinutes,
                availableHoursStart,
                availableHoursEnd,
                availableDays,
                3 // Reduced scope for quick check
            )
            if (slots.length === 0) {
                return new Response(
                    JSON.stringify({ success: false, error: 'No available slots found' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
            startTime = new Date(slots[0].start)
            endTime = new Date(slots[0].end)
            console.log('[CreateMeeting] Found next available slot:', startTime.toISOString())
        }

        // Crear evento (Google Calendar API...)
        const meetingTitle = (agentConfig.meetingTitle || 'Reunión con {nombre}').replace('{nombre}', leadName)
        let meetingDescription = (agentConfig.meetingDescription || 'Reunión programada automáticamente').replace('{nombre}', leadName)

        if (leadEmail) meetingDescription += `\n\nEmail del lead: ${leadEmail}`
        if (leadPhone) meetingDescription += `\nTeléfono: ${leadPhone}`

        const attendees = []
        if (leadEmail) attendees.push({ email: leadEmail })
        if (agentConfig.meetingEmail) attendees.push({ email: agentConfig.meetingEmail })

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
                    start: { dateTime: startTime.toISOString(), timeZone: 'America/Argentina/Buenos_Aires' },
                    end: { dateTime: endTime.toISOString(), timeZone: 'America/Argentina/Buenos_Aires' },
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
            console.error('[CreateMeeting] GCalendar Error:', errBody)
            throw new Error(`Failed to create event: ${eventResponse.statusText}`)
        }

        const event = await eventResponse.json()
        const meetingLink = event.hangoutLink || event.htmlLink

        console.log('[CreateMeeting] ✅ Meeting created:', event.id)

        // Guardar en BD (Best effort)
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
        } catch (e) {
            console.error('[CreateMeeting] DB Save Error:', e)
        }

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
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('[CreateMeeting] Critical Error:', error)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
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
    daysScope: number = 5
): Promise<Array<{ start: string; end: string }>> {
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const [startHour, startMinute] = availableHoursStart.split(':').map(Number)
    const [endHour, endMinute] = availableHoursEnd.split(':').map(Number)

    const now = new Date()
    now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0)

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
                console.error(`[CreateMeeting] Google API Error for ${checkDate.toISOString().split('T')[0]}: ${eventsRes.status} ${eventsRes.statusText}`)
                if (eventsRes.status === 401) throw new Error('Google Calendar Token Expired')
                return []
            }

            const eventsData = await eventsRes.json()
            const events = eventsData.items || []
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
    return results.flat().slice(0, 20) // Limit total returned slots to prevent large JSON
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
