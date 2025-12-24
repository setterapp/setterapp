/**
 * Notification Service
 * Maneja el envío de notificaciones a leads por WhatsApp e Instagram
 */

import { supabase } from '../lib/supabase'

interface MeetingNotificationData {
  leadName: string
  meetingDate: Date
  meetingLink: string
  duration: number // en minutos
  agentName?: string
  additionalNotes?: string
}

interface SendNotificationOptions {
  conversationId: string
  notificationData: MeetingNotificationData
}

/**
 * Envía una notificación de reunión al lead
 * Detecta automáticamente la plataforma y envía el mensaje apropiado
 */
export async function sendMeetingNotification(options: SendNotificationOptions): Promise<boolean> {
  const { conversationId, notificationData } = options

  try {
    // Obtener información de la conversación
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('platform, platform_conversation_id, platform_page_id, user_id')
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) {
      console.error('[Notifications] Error obteniendo conversación:', convError)
      return false
    }

    // Construir el mensaje de notificación
    const message = buildMeetingNotificationMessage(notificationData)

    // Enviar según la plataforma
    if (conversation.platform === 'whatsapp') {
      return await sendWhatsAppNotification(
        conversation.user_id,
        conversation.platform_page_id,
        conversation.platform_conversation_id,
        message,
        conversationId
      )
    } else if (conversation.platform === 'instagram') {
      return await sendInstagramNotification(
        conversation.user_id,
        conversation.platform_conversation_id,
        message,
        conversationId
      )
    } else {
      console.error('[Notifications] Plataforma no soportada:', conversation.platform)
      return false
    }
  } catch (error) {
    console.error('[Notifications] Error enviando notificación:', error)
    return false
  }
}

/**
 * Construye el mensaje de notificación de reunión
 */
function buildMeetingNotificationMessage(data: MeetingNotificationData): string {
  const { leadName, meetingDate, meetingLink, duration, agentName, additionalNotes } = data

  // Formatear fecha y hora en español
  const dateStr = meetingDate.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  const timeStr = meetingDate.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  })

  let message = `¡Hola ${leadName}! 🎉\n\n`
  message += `Tu reunión ha sido agendada exitosamente:\n\n`
  message += `📅 Fecha: ${dateStr}\n`
  message += `🕐 Hora: ${timeStr}\n`
  message += `⏱️ Duración: ${duration} minutos\n`

  if (agentName) {
    message += `👤 Con: ${agentName}\n`
  }

  message += `\n🔗 Link de la reunión:\n${meetingLink}\n`

  if (additionalNotes) {
    message += `\n📝 Notas:\n${additionalNotes}\n`
  }

  message += `\n¡Nos vemos pronto! 👋`

  return message
}

/**
 * Envía notificación por WhatsApp
 */
async function sendWhatsAppNotification(
  userId: string,
  phoneNumberId: string,
  recipientPhone: string,
  message: string,
  conversationId: string
): Promise<boolean> {
  try {
    // Obtener integración de WhatsApp
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('config')
      .eq('type', 'whatsapp')
      .eq('user_id', userId)
      .eq('status', 'connected')
      .single()

    if (error || !integration) {
      console.error('[Notifications] No se encontró integración de WhatsApp:', error)
      return false
    }

    const accessToken = integration.config?.access_token

    if (!accessToken) {
      console.error('[Notifications] Falta access token de WhatsApp')
      return false
    }

    // Enviar mensaje usando WhatsApp Cloud API
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipientPhone,
          type: 'text',
          text: { body: message }
        })
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[Notifications] Error enviando mensaje a WhatsApp:', errorData)
      return false
    }

    const data = await response.json()

    // Guardar notificación en BD
    await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        platform_message_id: data.messages?.[0]?.id || Date.now().toString(),
        content: message,
        direction: 'outbound',
        message_type: 'text',
        metadata: {
          notification_type: 'meeting_confirmation',
          sent_at: new Date().toISOString()
        },
      })

    console.log('[Notifications] ✅ Notificación de WhatsApp enviada exitosamente')
    return true
  } catch (error) {
    console.error('[Notifications] Error enviando notificación de WhatsApp:', error)
    return false
  }
}

/**
 * Envía notificación por Instagram
 */
async function sendInstagramNotification(
  userId: string,
  recipientId: string,
  message: string,
  conversationId: string
): Promise<boolean> {
  try {
    // Obtener integración de Instagram
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('config')
      .eq('type', 'instagram')
      .eq('user_id', userId)
      .eq('status', 'connected')
      .single()

    if (error || !integration) {
      console.error('[Notifications] No se encontró integración de Instagram:', error)
      return false
    }

    const accessToken = integration.config?.access_token
    const instagramUserId = integration.config?.instagram_user_id || integration.config?.instagram_page_id

    if (!accessToken || !instagramUserId) {
      console.error('[Notifications] Faltan credenciales de Instagram')
      return false
    }

    // Enviar mensaje usando Instagram Messaging API
    const response = await fetch(
      `https://graph.instagram.com/v21.0/${instagramUserId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: message }
        })
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[Notifications] Error enviando mensaje a Instagram:', errorData)
      return false
    }

    const data = await response.json()

    // Guardar notificación en BD
    await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        platform_message_id: data.message_id || data.id || Date.now().toString(),
        content: message,
        direction: 'outbound',
        message_type: 'text',
        metadata: {
          notification_type: 'meeting_confirmation',
          sent_at: new Date().toISOString()
        },
      })

    console.log('[Notifications] ✅ Notificación de Instagram enviada exitosamente')
    return true
  } catch (error) {
    console.error('[Notifications] Error enviando notificación de Instagram:', error)
    return false
  }
}

/**
 * Envía una notificación de recordatorio de reunión (para usar con un cron job más adelante)
 */
export async function sendMeetingReminder(
  conversationId: string,
  notificationData: MeetingNotificationData
): Promise<boolean> {
  return sendMeetingNotification({
    conversationId,
    notificationData: {
      ...notificationData,
      // Override message in buildMeetingNotificationMessage would require refactor
      // For now this is a separate function
    }
  })
}

/**
 * Encuentra reuniones que necesitan recordatorios y envía notificaciones automáticas
 * Esta función puede ser llamada por un cron job o Edge Function
 */
export async function sendScheduledMeetingReminders(): Promise<{
  success: boolean
  remindersSent: number
  errors: string[]
}> {
  const result = {
    success: true,
    remindersSent: 0,
    errors: [] as string[]
  }

  try {
    // Obtener todas las reuniones programadas para mañana
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStart = new Date(tomorrow)
    tomorrowStart.setHours(0, 0, 0, 0)
    const tomorrowEnd = new Date(tomorrow)
    tomorrowEnd.setHours(23, 59, 59, 999)

    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select(`
        id,
        user_id,
        conversation_id,
        meeting_date,
        duration_minutes,
        meeting_link,
        lead_name,
        agent_id,
        agents!inner (
          name
        )
      `)
      .eq('status', 'scheduled')
      .gte('meeting_date', tomorrowStart.toISOString())
      .lte('meeting_date', tomorrowEnd.toISOString())

    if (meetingsError) {
      result.errors.push(`Error fetching meetings: ${meetingsError.message}`)
      result.success = false
      return result
    }

    if (!meetings || meetings.length === 0) {
      console.log('[MeetingReminders] No meetings scheduled for tomorrow')
      return result
    }

    console.log(`[MeetingReminders] Found ${meetings.length} meetings for tomorrow`)

    // Enviar recordatorios para cada reunión
    for (const meeting of meetings) {
      try {
        if (!meeting.conversation_id) {
          result.errors.push(`Meeting ${meeting.id} has no conversation_id`)
          continue
        }

        const notificationData: MeetingNotificationData = {
          leadName: meeting.lead_name,
          meetingDate: new Date(meeting.meeting_date),
          meetingLink: meeting.meeting_link,
          duration: meeting.duration_minutes,
          agentName: (meeting.agents as any)?.name
        }

        const reminderSent = await sendMeetingReminder(meeting.conversation_id, notificationData)

        if (reminderSent) {
          result.remindersSent++
          console.log(`[MeetingReminders] ✅ Reminder sent for meeting ${meeting.id}`)
        } else {
          result.errors.push(`Failed to send reminder for meeting ${meeting.id}`)
        }
      } catch (meetingError: any) {
        result.errors.push(`Error processing meeting ${meeting.id}: ${meetingError.message}`)
        console.error('[MeetingReminders] Error processing meeting:', meetingError)
      }
    }

  } catch (error: any) {
    result.errors.push(`General error: ${error.message}`)
    result.success = false
    console.error('[MeetingReminders] General error:', error)
  }

  return result
}
