/**
 * Google Calendar Meetings Service
 * Maneja la creación automática de reuniones para agentes
 */

import { googleCalendarService } from './calendar'
import type { AgentConfig } from '../../hooks/useAgents'

interface TimeSlot {
  start: Date
  end: Date
}

interface MeetingOptions {
  leadName: string
  leadEmail?: string
  leadPhone?: string
  agentConfig: AgentConfig
  preferredDate?: Date // Si el lead sugiere una fecha
}

export const meetingsService = {
  /**
   * Crea una reunión automáticamente basándose en la configuración del agente
   * y los slots disponibles en el calendario
   */
  async createMeetingForLead(options: MeetingOptions) {
    const { leadName, leadEmail, leadPhone, agentConfig, preferredDate } = options

    console.log('[Meetings] Creating meeting for lead:', leadName)

    // Verificar que el agente tenga habilitada la generación de reuniones
    if (!agentConfig.enableMeetingScheduling) {
      throw new Error('El agente no tiene habilitada la generación de reuniones')
    }

    try {
      // 1. Obtener calendarios del usuario
      const calendars = await googleCalendarService.listCalendars()

      // Usar el calendario primario
      const primaryCalendar = calendars.find((cal: any) => cal.primary)
      if (!primaryCalendar) {
        throw new Error('No se encontró el calendario primario')
      }

      console.log('[Meetings] Using calendar:', primaryCalendar.summary)

      // 2. Encontrar el próximo slot disponible
      const slot = await this.findNextAvailableSlot(
        primaryCalendar.id,
        agentConfig,
        preferredDate
      )

      if (!slot) {
        throw new Error('No se encontraron slots disponibles en los próximos 7 días')
      }

      console.log('[Meetings] Found available slot:', {
        start: slot.start.toISOString(),
        end: slot.end.toISOString()
      })

      // 3. Crear el evento
      const title = (agentConfig.meetingTitle || 'Reunión con {nombre}')
        .replace('{nombre}', leadName)

      const description = [
        agentConfig.meetingDescription || '',
        leadEmail ? `\nEmail: ${leadEmail}` : '',
        leadPhone ? `\nTeléfono: ${leadPhone}` : '',
        '\n\n🤖 Reunión generada automáticamente por SetterApp'
      ].filter(Boolean).join('')

      const event = await googleCalendarService.createEvent({
        calendarId: primaryCalendar.id,
        summary: title,
        description,
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        attendees: leadEmail ? [leadEmail] : undefined
      })

      console.log('[Meetings] Event created:', event.id)

      return {
        success: true,
        event,
        slot,
        meetingLink: event.htmlLink
      }
    } catch (error) {
      console.error('[Meetings] Error creating meeting:', error)
      throw error
    }
  },

  /**
   * Encuentra el próximo slot disponible en el calendario
   */
  async findNextAvailableSlot(
    calendarId: string,
    agentConfig: AgentConfig,
    preferredDate?: Date
  ): Promise<TimeSlot | null> {
    const duration = agentConfig.meetingDuration || 30 // minutos
    const buffer = agentConfig.meetingBufferMinutes || 0
    const availableHoursStart = agentConfig.meetingAvailableHoursStart || '09:00'
    const availableHoursEnd = agentConfig.meetingAvailableHoursEnd || '18:00'
    const availableDays = agentConfig.meetingAvailableDays ||
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

    // Convertir días a números (0 = domingo, 1 = lunes, etc.)
    const dayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6
    }
    const availableDayNumbers = availableDays.map(d => dayMap[d])

    // Empezar desde la fecha preferida o desde mañana
    const startDate = preferredDate || new Date()
    startDate.setDate(startDate.getDate() + 1) // Empezar desde mañana
    startDate.setHours(0, 0, 0, 0)

    // Buscar hasta 7 días en el futuro
    const maxDate = new Date(startDate)
    maxDate.setDate(maxDate.getDate() + 7)

    console.log('[Meetings] Searching slots from', startDate.toISOString(), 'to', maxDate.toISOString())

    // Obtener eventos existentes en ese rango (máximo 250 eventos)
    const events = await googleCalendarService.listEvents({
      calendarId,
      timeMin: startDate.toISOString(),
      timeMax: maxDate.toISOString(),
      maxResults: 250
    })

    console.log('[Meetings] Found', events.length, 'existing events')

    // Iterar por cada día
    let currentDate = new Date(startDate)
    while (currentDate <= maxDate) {
      const dayOfWeek = currentDate.getDay()

      // Verificar si este día está disponible
      if (!availableDayNumbers.includes(dayOfWeek)) {
        currentDate.setDate(currentDate.getDate() + 1)
        continue
      }

      // Establecer horarios disponibles para este día
      const [startHour, startMinute] = availableHoursStart.split(':').map(Number)
      const [endHour, endMinute] = availableHoursEnd.split(':').map(Number)

      const dayStart = new Date(currentDate)
      dayStart.setHours(startHour, startMinute, 0, 0)

      const dayEnd = new Date(currentDate)
      dayEnd.setHours(endHour, endMinute, 0, 0)

      // Buscar slots disponibles en este día
      let slotStart = new Date(dayStart)

      while (slotStart < dayEnd) {
        const slotEnd = new Date(slotStart)
        slotEnd.setMinutes(slotEnd.getMinutes() + duration)

        // Verificar que el slot no se pase del horario disponible
        if (slotEnd > dayEnd) {
          break
        }

        // Verificar que el slot no se solape con eventos existentes
        const hasConflict = events.some((event: any) => {
          if (!event.start?.dateTime || !event.end?.dateTime) return false

          const eventStart = new Date(event.start.dateTime)
          const eventEnd = new Date(event.end.dateTime)

          // Agregar buffer al evento existente
          eventStart.setMinutes(eventStart.getMinutes() - buffer)
          eventEnd.setMinutes(eventEnd.getMinutes() + buffer)

          return (
            (slotStart >= eventStart && slotStart < eventEnd) ||
            (slotEnd > eventStart && slotEnd <= eventEnd) ||
            (slotStart <= eventStart && slotEnd >= eventEnd)
          )
        })

        if (!hasConflict) {
          // Encontramos un slot disponible!
          return {
            start: slotStart,
            end: slotEnd
          }
        }

        // Mover al siguiente slot (cada 15 minutos)
        slotStart = new Date(slotStart)
        slotStart.setMinutes(slotStart.getMinutes() + 15)
      }

      // Pasar al siguiente día
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // No se encontró ningún slot disponible
    return null
  },

  /**
   * Obtiene una lista de slots disponibles para que el usuario pueda elegir
   */
  async getAvailableSlots(
    agentConfig: AgentConfig,
    numberOfSlots: number = 5
  ): Promise<TimeSlot[]> {
    try {
      const calendars = await googleCalendarService.listCalendars()
      const primaryCalendar = calendars.find((cal: any) => cal.primary)

      if (!primaryCalendar) {
        throw new Error('No se encontró el calendario primario')
      }

      const slots: TimeSlot[] = []
      let currentDate = new Date()
      let attempts = 0
      const maxAttempts = 50 // Evitar bucles infinitos

      while (slots.length < numberOfSlots && attempts < maxAttempts) {
        const slot = await this.findNextAvailableSlot(
          primaryCalendar.id,
          agentConfig,
          currentDate
        )

        if (slot) {
          slots.push(slot)
          // Buscar el siguiente slot después de este
          currentDate = new Date(slot.end)
          currentDate.setMinutes(currentDate.getMinutes() + 1)
        } else {
          break
        }

        attempts++
      }

      return slots
    } catch (error) {
      console.error('[Meetings] Error getting available slots:', error)
      throw error
    }
  }
}
