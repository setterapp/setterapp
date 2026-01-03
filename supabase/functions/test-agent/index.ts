import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Use Google AI (same as production webhooks)
const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AgentConfig {
  assistantName?: string;
  companyName?: string;
  ownerName?: string;
  businessNiche?: string;
  clientGoals?: string;
  offerDetails?: string;
  importantLinks?: string[];
  openingQuestion?: string;
  activeHoursStart?: string;
  activeHoursEnd?: string;
  enableQualification?: boolean;
  qualifyingQuestion?: string;
  qualificationCriteria?: string;
  disqualifyMessage?: string;
  toneGuidelines?: string;
  additionalContext?: string;
  conversationExamples?: string;
  responseInterval?: number;
  languageAccent?: string;
}

function getAccentInstructions(languageAccent: string): string {
  const accentMap: Record<string, string> = {
    'es-ES': 'Habla español de España. Usa "tú" y expresiones españolas.',
    'es-MX': 'Habla español de México. Usa expresiones mexicanas.',
    'es-AR': 'Habla español de Argentina. Usa "vos" y expresiones argentinas.',
    'es-CO': 'Habla español de Colombia. Usa expresiones colombianas.',
    'es-CL': 'Habla español de Chile. Usa expresiones chilenas.',
    'es-PE': 'Habla español de Perú. Usa expresiones peruanas.',
    'en-US': 'Speak American English.',
    'en-GB': 'Speak British English.',
    'pt-BR': 'Fale português do Brasil.',
    'pt-PT': 'Fale português de Portugal.',
    'fr-FR': 'Parle français.',
    'de-DE': 'Sprich Deutsch.',
    'it-IT': 'Parla italiano.',
  };
  return accentMap[languageAccent] || '';
}

function buildSystemPrompt(agentName: string, description: string, config?: AgentConfig): string {
  let prompt = description || `Eres ${agentName || 'un asistente de IA'}.`;

  // Add language/accent based on config
  const languageAccent = config?.languageAccent || 'es-ES';
  const accentInstructions = getAccentInstructions(languageAccent);
  if (accentInstructions) {
    prompt += `\n\nIDIOMA: ${accentInstructions}`;
  }

  // Identidad del asistente
  if (config?.assistantName || config?.companyName || config?.ownerName) {
    prompt += `\n\nIDENTIDAD:`;
    if (config?.assistantName) prompt += ` Nombre: ${config.assistantName}.`;
    if (config?.companyName) prompt += ` Empresa: ${config.companyName}.`;
    if (config?.ownerName) prompt += ` Jefe: ${config.ownerName}.`;
  }

  // Información del negocio
  if (config?.businessNiche || config?.clientGoals || config?.offerDetails || config?.importantLinks?.length) {
    prompt += `\n\nNEGOCIO:`;
    if (config?.businessNiche) prompt += ` Nicho: ${config.businessNiche}.`;
    if (config?.clientGoals) prompt += ` Objetivos: ${config.clientGoals}.`;
    if (config?.offerDetails) prompt += ` Oferta: ${config.offerDetails}.`;
    if (config?.importantLinks && config.importantLinks.length > 0) {
      prompt += ` Links importantes: ${config.importantLinks.join(', ')}.`;
    }
  }

  // Calificación de leads
  if (config?.enableQualification) {
    prompt += `\n\nCALIFICACIÓN DE LEADS:`;
    if (config?.qualifyingQuestion) prompt += ` Pregunta clave: "${config.qualifyingQuestion}"`;
    if (config?.qualificationCriteria) prompt += ` Criterios: ${config.qualificationCriteria}`;
    if (config?.disqualifyMessage) prompt += ` Si no califica: "${config.disqualifyMessage}"`;
  }

  // Personalización
  if (config?.toneGuidelines) {
    prompt += `\n\nESTILO: ${config.toneGuidelines}`;
  }
  if (config?.additionalContext) {
    prompt += `\n\nCONTEXTO: ${config.additionalContext}`;
  }
  if (config?.conversationExamples) {
    prompt += `\n\nEJEMPLOS:\n${config.conversationExamples}`;
  }

  // Instrucciones finales - same style as Instagram webhook
  prompt += `

ESTILO:
- Habla como un amigo por Instagram, casual y directo
- Respuestas cortas la mayoría del tiempo (5-15 palabras)
- Si necesitas explicar algo, puedes usar 2-3 oraciones
- IMPORTANTE: Siempre usa punto (.) al final de cada oración antes de empezar otra
- Sin emojis
- Nunca preguntes "quieres saber más?" ni "te ayudo en algo más?"
- Solo usa ? (nunca ¿)

NOTA: Esto es una PRUEBA del agente, no una conversación real.`;

  return prompt;
}

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const { agent_name, description, user_message, conversation_history, config } = await req.json();

    if (!user_message) {
      return new Response(
        JSON.stringify({ error: 'user_message is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    if (!GOOGLE_AI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Google AI API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const systemPrompt = buildSystemPrompt(agent_name || 'Asistente', description || '', config);

    // Build conversation for Gemini format
    const contents: any[] = [];

    // Add conversation history
    for (const msg of (conversation_history || [])) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }

    // Add current user message
    contents.push({
      role: 'user',
      parts: [{ text: user_message }]
    });

    console.log('[test-agent] Generating response for:', agent_name);

    // Use Gemini 3 Flash (same as production)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[test-agent] Gemini error:', errorData);
      return new Response(
        JSON.stringify({ error: errorData.error?.message || `Gemini API error: ${response.status}` }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts?.map((p: any) => p.text).join('') || '';

    console.log('[test-agent] Response generated successfully');

    // NOTE: This is a TEST - no message credits are counted, no messages are saved to DB

    return new Response(
      JSON.stringify({
        content,
        model: 'gemini-2.0-flash'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (error) {
    console.error('[test-agent] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
});
