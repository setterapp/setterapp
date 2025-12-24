import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('[SendMeetingReminders] Starting scheduled meeting reminders...')

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
        agents (
          name
        )
      `)
      .eq('status', 'scheduled')
      .gte('meeting_date', tomorrowStart.toISOString())
      .lte('meeting_date', tomorrowEnd.toISOString())

    if (meetingsError) {
      throw new Error(`Error fetching meetings: ${meetingsError.message}`)
    }

    if (!meetings || meetings.length === 0) {
      console.log('[SendMeetingReminders] No meetings scheduled for tomorrow')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No meetings scheduled for tomorrow',
          remindersSent: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[SendMeetingReminders] Found ${meetings.length} meetings for tomorrow`)

    let remindersSent = 0
    const errors: string[] = []

    // Enviar recordatorios para cada reunión
    for (const meeting of meetings) {
      try {
        if (!meeting.conversation_id) {
          errors.push(`Meeting ${meeting.id} has no conversation_id`)
          continue
        }

        // Obtener información de la conversación
        const { data: conversation, error: convError } = await supabase
          .from('conversations')
          .select('platform, platform_conversation_id, platform_page_id, user_id')
          .eq('id', meeting.conversation_id)
          .single()

        if (convError || !conversation) {
          errors.push(`Conversation not found for meeting ${meeting.id}`)
          continue
        }

        // Construir mensaje de recordatorio
        const meetingDate = new Date(meeting.meeting_date)
        const reminderMessage = buildReminderMessage({
          leadName: meeting.lead_name,
          meetingDate,
          meetingLink: meeting.meeting_link,
          duration: meeting.duration_minutes,
          agentName: meeting.agents?.name
        })

        // Enviar según la plataforma
        let messageSent = false

        if (conversation.platform === 'whatsapp') {
          messageSent = await sendWhatsAppMessage(
            conversation.user_id,
            conversation.platform_page_id,
            conversation.platform_conversation_id,
            reminderMessage,
            meeting.conversation_id
          )
        } else if (conversation.platform === 'instagram') {
          messageSent = await sendInstagramMessage(
            conversation.user_id,
            conversation.platform_conversation_id,
            reminderMessage,
            meeting.conversation_id
          )
        }

        if (messageSent) {
          remindersSent++
          console.log(`[SendMeetingReminders] ✅ Reminder sent for meeting ${meeting.id}`)
        } else {
          errors.push(`Failed to send reminder for meeting ${meeting.id}`)
        }
      } catch (meetingError: any) {
        errors.push(`Error processing meeting ${meeting.id}: ${meetingError.message}`)
        console.error('[SendMeetingReminders] Error processing meeting:', meetingError)
      }
    }

    console.log(`[SendMeetingReminders] Completed. Sent ${remindersSent} reminders.`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${remindersSent} meeting reminders`,
        remindersSent,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('[SendMeetingReminders] Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function buildReminderMessage(data: {
  leadName: string
  meetingDate: Date
  meetingLink: string
  duration: number
  agentName?: string
}): string {
  const { leadName, meetingDate, meetingLink, duration, agentName } = data

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

  let message = `¡Hola ${leadName}! 👋\n\n`
  message += `Te recordamos que tu reunión está programada para mañana:\n\n`
  message += `📅 Fecha: ${dateStr}\n`
  message += `🕐 Hora: ${timeStr}\n`
  message += `⏱️ Duración: ${duration} minutos\n`

  if (agentName) {
    message += `👤 Con: ${agentName}\n`
  }

  message += `\n🔗 Link de la reunión:\n${meetingLink}\n\n`
  message += `¡Nos vemos pronto!`

  return message
}

async function sendWhatsAppMessage(
  userId: string,
  phoneNumberId: string,
  recipientPhone: string,
  message: string,
  conversationId: string
): Promise<boolean> {
  try {
    // Obtener integración de WhatsApp
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: integration, error } = await supabase
      .from('integrations')
      .select('config')
      .eq('type', 'whatsapp')
      .eq('user_id', userId)
      .eq('status', 'connected')
      .single()

    if (error || !integration) {
      console.error('[SendMeetingReminders] No WhatsApp integration found:', error)
      return false
    }

    const accessToken = integration.config?.access_token

    if (!accessToken) {
      console.error('[SendMeetingReminders] Missing WhatsApp access token')
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
      console.error('[SendMeetingReminders] Error sending WhatsApp message:', errorData)
      return false
    }

    const data = await response.json()

    // Guardar mensaje en BD
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
          notification_type: 'meeting_reminder',
          sent_at: new Date().toISOString()
        },
      })

    return true
  } catch (error) {
    console.error('[SendMeetingReminders] Error sending WhatsApp message:', error)
    return false
  }
}

async function sendInstagramMessage(
  userId: string,
  recipientId: string,
  message: string,
  conversationId: string
): Promise<boolean> {
  try {
    // Obtener integración de Instagram
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: integration, error } = await supabase
      .from('integrations')
      .select('config')
      .eq('type', 'instagram')
      .eq('user_id', userId)
      .eq('status', 'connected')
      .single()

    if (error || !integration) {
      console.error('[SendMeetingReminders] No Instagram integration found:', error)
      return false
    }

    const accessToken = integration.config?.access_token
    const instagramUserId = integration.config?.instagram_user_id || integration.config?.instagram_page_id

    if (!accessToken || !instagramUserId) {
      console.error('[SendMeetingReminders] Missing Instagram credentials')
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
      console.error('[SendMeetingReminders] Error sending Instagram message:', errorData)
      return false
    }

    const data = await response.json()

    // Guardar mensaje en BD
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
          notification_type: 'meeting_reminder',
          sent_at: new Date().toISOString()
        },
      })

    return true
  } catch (error) {
    console.error('[SendMeetingReminders] Error sending Instagram message:', error)
    return false
  }
}
