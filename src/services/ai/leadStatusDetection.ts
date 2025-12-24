/**
 * Lead Status Detection Service
 * Usa IA para detectar automáticamente el estado del lead basándose en la conversación
 */

interface Message {
  content: string
  sender: 'agent' | 'lead'
  timestamp: string
}

export type LeadStatus = 'cold' | 'warm' | 'hot' | 'closed' | 'not_closed'

interface LeadStatusResult {
  status: LeadStatus
  confidence: number // 0-1
  reasoning: string
}

/**
 * Analiza la conversación y determina el estado del lead usando IA (modelo económico)
 */
export async function detectLeadStatus(messages: Message[]): Promise<LeadStatusResult> {
  return detectLeadStatusWithModel(messages, 'gpt-3.5-turbo')
}

/**
 * Analiza la conversación y determina el estado del lead usando IA con modelo específico
 */
export async function detectLeadStatusWithModel(messages: Message[], model: string = 'gpt-3.5-turbo'): Promise<LeadStatusResult> {
  console.log(`[LeadStatus] Analyzing conversation with ${messages.length} messages using ${model}`)

  const apiKey = import.meta.env.VITE_OPENAI_API_KEY

  if (!apiKey) {
    console.warn('[LeadStatus] No OpenAI API key configured, defaulting to warm')
    return {
      status: 'warm',
      confidence: 0.5,
      reasoning: 'No AI analysis available'
    }
  }

  try {
    // Preparar el contexto de la conversación (últimos 8 mensajes para mantener bajo costo)
    const recentMessages = messages.slice(-8)
    const conversationText = recentMessages.map(m =>
      `${m.sender === 'agent' ? 'A' : 'L'}: ${m.content.substring(0, 100)}` // Limitar longitud
    ).join('\n')

    const prompt = `Analiza estos mensajes recientes de una conversación de ventas y determina el estado actual del lead:

${conversationText}

Estados:
- COLD: No interesado, rechaza, negativo
- WARM: Interés moderado, preguntas básicas
- HOT: Muy interesado, pregunta precios/fechas
- CLOSED: Compra realizada exitosamente
- NOT_CLOSED: Cerrado sin conversión

Responde solo con JSON: {"status": "cold|warm|hot|closed|not_closed", "confidence": 0.0-1.0, "reasoning": "breve explicación"}`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'Clasifica leads en ventas. Responde solo con JSON válido.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2, // Más determinista
        max_tokens: 100   // Menos tokens para reducir costo
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No response from OpenAI')
    }

    // Parsear la respuesta JSON
    const result = JSON.parse(content.trim()) as LeadStatusResult

    console.log('[LeadStatus] Detection result:', result)

    return result
  } catch (error) {
    console.error('[LeadStatus] Error detecting lead status:', error)

    // Fallback: analizar con reglas simples
    return fallbackDetection(messages)
  }
}

/**
 * Detección fallback usando reglas simples si la IA falla
 */
function fallbackDetection(messages: Message[]): LeadStatusResult {
  const lastMessages = messages.slice(-5) // Últimos 5 mensajes
  const leadMessages = lastMessages.filter(m => m.sender === 'lead')

  if (leadMessages.length === 0) {
    return {
      status: 'cold',
      confidence: 0.6,
      reasoning: 'El lead no ha respondido recientemente'
    }
  }

  const allText = leadMessages.map(m => m.content.toLowerCase()).join(' ')

  // Palabras clave para diferentes estados
  const hotKeywords = ['precio', 'costo', 'cuanto', 'reunión', 'llamada', 'agendar', 'comprar', 'contratar', 'empezar', 'si quiero', 'me interesa mucho']
  const coldKeywords = ['no gracias', 'no me interesa', 'no estoy interesado', 'no', 'después', 'más tarde', 'ocupado']
  const closedKeywords = ['listo', 'perfecto hagamos', 'cuando empezamos', 'agendado', 'confirmado', 'comprado']
  const notClosedKeywords = ['ya no', 'cancelar', 'rechazar', 'no quiero', 'perdí interés', 'cambiar de opinión', 'no es para mí', 'otro proveedor', 'competencia']

  const hotCount = hotKeywords.filter(k => allText.includes(k)).length
  const coldCount = coldKeywords.filter(k => allText.includes(k)).length
  const closedCount = closedKeywords.filter(k => allText.includes(k)).length
  const notClosedCount = notClosedKeywords.filter(k => allText.includes(k)).length

  // Check for 'not_closed' first (rejection signals)
  if (notClosedCount > 0) {
    return {
      status: 'not_closed',
      confidence: Math.min(notClosedCount * 0.4, 0.95),
      reasoning: 'El lead muestra señales claras de rechazo o pérdida de interés'
    }
  }

  if (closedCount > 0) {
    return {
      status: 'closed',
      confidence: 0.7,
      reasoning: 'El lead ha confirmado el siguiente paso o la compra'
    }
  }

  if (hotCount > coldCount && hotCount >= 2) {
    return {
      status: 'hot',
      confidence: 0.7,
      reasoning: 'El lead muestra alto interés y hace preguntas específicas'
    }
  }

  if (coldCount > hotCount && coldCount >= 2) {
    return {
      status: 'cold',
      confidence: 0.7,
      reasoning: 'El lead muestra poco interés o rechaza la oferta'
    }
  }

  return {
    status: 'warm',
    confidence: 0.6,
    reasoning: 'El lead muestra interés moderado'
  }
}

/**
 * Determina si el lead está calificado para agendar una reunión
 * Un lead está calificado si está en estado 'hot'
 */
export function isLeadQualifiedForMeeting(status: LeadStatus): boolean {
  return status === 'hot'
}

/**
 * Formatea el mensaje de cambio de estado para notificar al usuario
 */
export function getStatusChangeMessage(oldStatus: LeadStatus | null, newStatus: LeadStatus): string | null {
  if (oldStatus === newStatus) return null

  const statusLabels: Record<LeadStatus, string> = {
    cold: 'Frío ❄️',
    warm: 'Tibio 🌡️',
    hot: 'Caliente 🔥',
    closed: 'Cerrado ✅',
    not_closed: 'No Cerrado ❌'
  }

  if (!oldStatus) {
    return `Lead clasificado como: ${statusLabels[newStatus]}`
  }

  return `Estado del lead actualizado: ${statusLabels[oldStatus]} → ${statusLabels[newStatus]}`
}

/**
 * Sincroniza el lead_status desde conversations hacia contacts
 */
export async function syncContactsLeadStatus(): Promise<{
  success: boolean
  synced: number
  message: string
}> {
  try {
    console.log('[LeadStatus] Syncing lead status from conversations to contacts...')

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    )

    // Ejecutar la sincronización usando RPC (si existe) o directamente con query
    const { data, error } = await supabase.rpc('sync_contacts_lead_status')

    if (error) {
      console.error('[LeadStatus] Error syncing contacts lead status:', error)
      return {
        success: false,
        synced: 0,
        message: `Error: ${error.message}`
      }
    }

    return {
      success: true,
      synced: data || 0,
      message: `Synchronized ${data || 0} contacts`
    }

  } catch (error: any) {
    console.error('[LeadStatus] Error in contact sync:', error)
    return {
      success: false,
      synced: 0,
      message: `Error: ${error.message}`
    }
  }
}

/**
 * Clasifica automáticamente el estado del lead cuando llega un mensaje nuevo (usando modelo económico)
 */
export async function autoClassifyLeadStatus(conversationId: string): Promise<{
  success: boolean
  statusChanged: boolean
  oldStatus?: LeadStatus
  newStatus?: LeadStatus
  confidence?: number
}> {
  try {
    console.log('[LeadStatus] Auto-classifying lead status for conversation:', conversationId)

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    )

    // Obtener mensajes recientes de la conversación
    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('content, sender, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(12) // Últimos 12 mensajes para contexto

    if (messagesError) {
      console.error('[LeadStatus] Error fetching messages:', messagesError)
      return { success: false, statusChanged: false }
    }

    if (!messagesData || messagesData.length === 0) {
      return { success: true, statusChanged: false }
    }

    // Convertir a formato Message
    const messages: Message[] = messagesData.map(m => ({
      content: m.content,
      sender: m.sender as 'agent' | 'lead',
      timestamp: m.created_at
    }))

    // Solo clasificar si hay al menos 3 mensajes y el último es del lead
    if (messages.length < 3 || messages[messages.length - 1].sender !== 'lead') {
      return { success: true, statusChanged: false }
    }

    // Clasificar usando el modelo económico
    const result = await detectLeadStatusWithModel(messages, 'gpt-3.5-turbo')

    if (result.confidence < 0.6) {
      console.log('[LeadStatus] Low confidence, skipping classification')
      return { success: true, statusChanged: false }
    }

    // Obtener estado actual
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('lead_status, contact_id')
      .eq('id', conversationId)
      .single()

    if (convError) {
      console.error('[LeadStatus] Error fetching conversation:', convError)
      return { success: false, statusChanged: false }
    }

    const oldStatus = conversation?.lead_status as LeadStatus | null
    const newStatus = result.status

    // Solo actualizar si el estado cambió
    if (oldStatus === newStatus) {
      return { success: true, statusChanged: false, oldStatus: oldStatus || undefined, newStatus, confidence: result.confidence }
    }

    console.log(`[LeadStatus] Status changed: ${oldStatus} -> ${newStatus} (confidence: ${result.confidence})`)

    // Actualizar conversación
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        lead_status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)

    if (updateError) {
      console.error('[LeadStatus] Error updating conversation:', updateError)
      return { success: false, statusChanged: false }
    }

    // Actualizar contacto si existe
    if (conversation.contact_id) {
      const { error: contactError } = await supabase
        .from('contacts')
        .update({
          lead_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation.contact_id)

      if (contactError) {
        console.error('[LeadStatus] Error updating contact:', contactError)
        // No fallar la operación principal
      }
    }

    return {
      success: true,
      statusChanged: true,
      oldStatus: oldStatus || undefined,
      newStatus,
      confidence: result.confidence
    }

  } catch (error: any) {
    console.error('[LeadStatus] Error in auto classification:', error)
    return { success: false, statusChanged: false }
  }
}

/**
 * Procesa automáticamente todas las conversaciones sin estado de lead
 */
export async function processAllConversationsWithoutLeadStatus(): Promise<{
  success: boolean
  processed: number
  errors: number
  message: string
}> {
  try {
    console.log('[LeadStatus] Starting bulk processing of conversations without lead status...')

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    )

    // Obtener todas las conversaciones sin estado
    const { data: conversations, error: fetchError } = await supabase
      .from('conversations')
      .select('id')
      .is('lead_status', null)

    if (fetchError) {
      throw new Error(`Error fetching conversations: ${fetchError.message}`)
    }

    if (!conversations || conversations.length === 0) {
      return {
        success: true,
        processed: 0,
        errors: 0,
        message: 'No conversations without lead status found'
      }
    }

    console.log(`[LeadStatus] Found ${conversations.length} conversations to process`)

    let processed = 0
    let errors = 0

    // Procesar conversaciones por lotes para no sobrecargar
    const batchSize = 5
    for (let i = 0; i < conversations.length; i += batchSize) {
      const batch = conversations.slice(i, i + batchSize)

      const promises = batch.map(async (conversation) => {
        try {
          // Llamar a la Edge Function para detectar el estado
          const { data, error } = await supabase.functions.invoke('detect-lead-status', {
            body: { conversationId: conversation.id }
          })

          if (error) {
            console.error(`[LeadStatus] Error processing conversation ${conversation.id}:`, error)
            errors++
          } else if (data?.success) {
            processed++
            console.log(`[LeadStatus] Processed conversation ${conversation.id}: ${data.newStatus}`)
          } else {
            errors++
          }
        } catch (err) {
          console.error(`[LeadStatus] Error processing conversation ${conversation.id}:`, err)
          errors++
        }
      })

      // Esperar a que termine el lote antes de continuar
      await Promise.all(promises)

      // Pequeña pausa entre lotes
      if (i + batchSize < conversations.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return {
      success: true,
      processed,
      errors,
      message: `Processed ${processed} conversations with ${errors} errors`
    }

  } catch (error: any) {
    console.error('[LeadStatus] Error in bulk processing:', error)
    return {
      success: false,
      processed: 0,
      errors: 1,
      message: `Error: ${error.message}`
    }
  }
}
