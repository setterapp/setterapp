import type { AgentConfig } from '../hooks/useAgents'

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatResponse {
  content: string
  tokens?: number
  model?: string
}

/**
 * Construye el system prompt completo basado en la configuración del agente
 */
export function buildSystemPrompt(agentName: string, description: string, config?: AgentConfig): string {
  let prompt = `Eres ${agentName || 'un asistente de IA'}.\n\n`

  // Descripción básica
  if (description) {
    prompt += `Descripción: ${description}\n\n`
  }

  // Identidad del asistente
  if (config?.assistantName) {
    prompt += `Tu nombre es ${config.assistantName}.\n`
  }
  if (config?.companyName) {
    prompt += `Trabajas para ${config.companyName}.\n`
  }
  if (config?.ownerName) {
    prompt += `El propietario es ${config.ownerName}.\n`
  }

  // Información del negocio
  if (config?.businessNiche) {
    prompt += `\nNicho de negocio: ${config.businessNiche}\n`
  }
  if (config?.clientGoals) {
    prompt += `\nObjetivos que ayudas a lograr: ${config.clientGoals}\n`
  }
  if (config?.offerDetails) {
    prompt += `\nDetalles de la oferta: ${config.offerDetails}\n`
  }
  if (config?.importantLinks && config.importantLinks.length > 0) {
    prompt += `\nEnlaces importantes:\n${config.importantLinks.map(link => `- ${link}`).join('\n')}\n`
  }

  // Comportamiento
  if (config?.openingQuestion) {
    prompt += `\nTu pregunta de apertura es: "${config.openingQuestion}"\n`
  }
  if (config?.activeHoursStart && config?.activeHoursEnd) {
    prompt += `\nHorario activo: ${config.activeHoursStart} - ${config.activeHoursEnd}\n`
  }

  // Calificación de leads
  if (config?.enableQualification) {
    prompt += `\nDebes calificar a los leads.\n`
    if (config?.qualifyingQuestion) {
      prompt += `Pregunta de calificación: "${config.qualifyingQuestion}"\n`
    }
    if (config?.qualificationCriteria) {
      prompt += `Criterios de calificación: ${config.qualificationCriteria}\n`
    }
    if (config?.disqualifyMessage) {
      prompt += `Mensaje para descalificados: ${config.disqualifyMessage}\n`
    }
  }

  // Personalización
  if (config?.toneGuidelines) {
    prompt += `\nGuías de tono: ${config.toneGuidelines}\n`
  }
  if (config?.additionalContext) {
    prompt += `\nContexto adicional: ${config.additionalContext}\n`
  }

  // Instrucciones finales
  prompt += `\n\nINSTRUCCIONES IMPORTANTES:\n`
  prompt += `- Responde de manera natural, amigable y profesional.\n`
  prompt += `- Mantén las conversaciones enfocadas y útiles.\n`
  prompt += `- Sé conciso pero completo en tus respuestas.\n`
  prompt += `- Si no sabes algo, admítelo honestamente.\n`
  prompt += `- Siempre mantén el tono y estilo definido en las guías de tono.\n`

  if (config?.responseInterval) {
    prompt += `- Responde aproximadamente cada ${config.responseInterval} minutos cuando sea apropiado.\n`
  }

  return prompt
}

/**
 * Genera una respuesta usando OpenAI
 */
export async function generateResponse(
  systemPrompt: string,
  conversationHistory: ChatMessage[] = [],
  model: string = 'gpt-4o-mini'
): Promise<ChatResponse> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key no configurada. Por favor, configura VITE_OPENAI_API_KEY en el archivo .env')
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory
  ]

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: 0.7,
        max_tokens: 500
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `Error de API: ${response.status}`)
    }

    const data = await response.json()

    return {
      content: data.choices[0].message.content,
      tokens: data.usage?.total_tokens,
      model: data.model
    }
  } catch (error: any) {
    console.error('Error generando respuesta:', error)
    throw new Error(error.message || 'Error al generar respuesta')
  }
}

/**
 * Genera una respuesta para un agente específico
 */
export async function generateAgentResponse(
  agentName: string,
  description: string,
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
  config?: AgentConfig,
  model: string = 'gpt-4o-mini'
): Promise<ChatResponse> {
  const systemPrompt = buildSystemPrompt(agentName, description, config)

  const messages: ChatMessage[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ]

  return generateResponse(systemPrompt, messages, model)
}
