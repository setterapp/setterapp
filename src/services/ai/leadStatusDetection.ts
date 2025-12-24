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
 * Analiza la conversación y determina el estado del lead usando IA
 */
export async function detectLeadStatus(messages: Message[]): Promise<LeadStatusResult> {
  console.log('[LeadStatus] Analyzing conversation with', messages.length, 'messages')

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
    // Preparar el contexto de la conversación
    const conversationText = messages.map(m =>
      `${m.sender === 'agent' ? 'Agente' : 'Lead'}: ${m.content}`
    ).join('\n')

    const prompt = `Analiza esta conversación entre un agente de ventas y un lead potencial.

Conversación:
${conversationText}

Determina el estado del lead según estos criterios:

- COLD (Frío): El lead no está interesado, no responde bien, da respuestas cortas negativas, o explícitamente rechaza la oferta
- WARM (Tibio): El lead muestra cierto interés, hace preguntas, pero aún no está listo para comprometerse
- HOT (Caliente): El lead está muy interesado, pregunta sobre precios, quiere agendar una llamada, solicita más detalles específicos, está listo para avanzar
- CLOSED (Cerrado): El lead ya realizó la compra exitosamente o se comprometió definitivamente
- NOT_CLOSED (No Cerrado): El lead fue cerrado pero no convertido (rechazado, perdió interés, eligió competencia, etc.)

Responde SOLO con un objeto JSON en este formato exacto:
{
  "status": "cold" | "warm" | "hot" | "closed" | "not_closed",
  "confidence": 0.0-1.0,
  "reasoning": "breve explicación de por qué elegiste este estado"
}`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en ventas que analiza conversaciones para determinar el nivel de interés de leads. Respondes solo con JSON válido.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 200
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
