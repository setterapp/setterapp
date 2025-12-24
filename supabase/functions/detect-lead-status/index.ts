import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Message {
  content: string
  sender: 'agent' | 'lead'
  timestamp: string
}

type LeadStatus = 'cold' | 'warm' | 'hot' | 'closed' | 'not_closed'

interface LeadStatusResult {
  status: LeadStatus
  confidence: number
  reasoning: string
}

async function detectLeadStatus(messages: Message[], openaiApiKey: string): Promise<LeadStatusResult> {
  console.log('[LeadStatus] Analyzing conversation with', messages.length, 'messages')

  if (!openaiApiKey) {
    console.warn('[LeadStatus] No OpenAI API key configured, using fallback')
    return fallbackDetection(messages)
  }

  try {
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
        'Authorization': `Bearer ${openaiApiKey}`,
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

    const result = JSON.parse(content.trim()) as LeadStatusResult
    console.log('[LeadStatus] Detection result:', result)
    return result
  } catch (error) {
    console.error('[LeadStatus] Error detecting lead status:', error)
    return fallbackDetection(messages)
  }
}

function fallbackDetection(messages: Message[]): LeadStatusResult {
  const lastMessages = messages.slice(-5)
  const leadMessages = lastMessages.filter(m => m.sender === 'lead')

  if (leadMessages.length === 0) {
    return {
      status: 'cold',
      confidence: 0.6,
      reasoning: 'El lead no ha respondido recientemente'
    }
  }

  const allText = leadMessages.map(m => m.content.toLowerCase()).join(' ')

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY') || ''

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { conversationId } = await req.json()

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: 'conversationId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[DetectLeadStatus] Processing conversation:', conversationId)

    // Obtener los últimos 20 mensajes de la conversación
    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('content, sender, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20)

    if (messagesError) {
      throw messagesError
    }

    if (!messagesData || messagesData.length === 0) {
      console.log('[DetectLeadStatus] No messages found, skipping detection')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No messages to analyze',
          statusUnchanged: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Convertir mensajes al formato esperado
    const messages: Message[] = messagesData.map(m => ({
      content: m.content,
      sender: m.sender as 'agent' | 'lead',
      timestamp: m.created_at
    }))

    // Detectar estado del lead
    const result = await detectLeadStatus(messages, openaiApiKey)

    // Obtener conversación actual
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('lead_status, contact_id')
      .eq('id', conversationId)
      .single()

    if (convError) {
      throw convError
    }

    const oldStatus = conversation?.lead_status as LeadStatus | null
    const newStatus = result.status

    // Solo actualizar si el estado cambió
    if (oldStatus !== newStatus) {
      console.log('[DetectLeadStatus] Status changed:', oldStatus, '->', newStatus)

      // Actualizar conversación
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          lead_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId)

      if (updateError) {
        throw updateError
      }

      // Si hay un contacto asociado, actualizar su estado también
      if (conversation.contact_id) {
        await supabase
          .from('contacts')
          .update({
            lead_status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', conversation.contact_id)
      }

      return new Response(
        JSON.stringify({
          success: true,
          oldStatus,
          newStatus,
          confidence: result.confidence,
          reasoning: result.reasoning,
          statusChanged: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      console.log('[DetectLeadStatus] Status unchanged:', newStatus)
      return new Response(
        JSON.stringify({
          success: true,
          status: newStatus,
          confidence: result.confidence,
          reasoning: result.reasoning,
          statusChanged: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('[DetectLeadStatus] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
