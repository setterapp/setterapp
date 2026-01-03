import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

// Use Google AI (same as production webhooks)
const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Maps language code to accent instructions (SAME AS INSTAGRAM WEBHOOK)
 */
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

/**
 * Obtiene las knowledge bases asociadas a un agent (SAME AS INSTAGRAM WEBHOOK)
 */
async function getAgentKnowledgeBases(agentId: string): Promise<string[]> {
  try {
    const { data: knowledgeBases, error } = await supabase
      .from('knowledge_bases')
      .select('name, content')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[test-agent] Error getting knowledge bases:', error);
      return [];
    }

    if (!knowledgeBases || knowledgeBases.length === 0) {
      return [];
    }

    console.log(`[test-agent] Found ${knowledgeBases.length} knowledge base(s)`);

    // Return formatted knowledge base content (same format as Instagram webhook)
    return knowledgeBases.map(kb => `[${kb.name}]\n${kb.content}`);
  } catch (error) {
    console.error('[test-agent] Error getting knowledge bases:', error);
    return [];
  }
}

/**
 * Builds the system prompt - EXACT COPY FROM INSTAGRAM WEBHOOK
 */
function buildSystemPrompt(agentName: string, description: string, config: any, contactContext?: string | null, knowledgeBases?: string[]): string {
  let prompt = `${description || `You are ${agentName}.`}`;

  // Add language/accent based on config
  const languageAccent = config?.languageAccent || 'es-ES';
  const accentInstructions = getAccentInstructions(languageAccent);
  if (accentInstructions) {
    prompt += `\n\nIDIOMA: ${accentInstructions}`;
  }

  // Add identity information if configured
  if (config?.assistantName || config?.companyName || config?.ownerName) {
    prompt += `\n\nIDENTITY:`;
    if (config.assistantName) prompt += ` Name: ${config.assistantName}.`;
    if (config.companyName) prompt += ` Company: ${config.companyName}.`;
    if (config.ownerName) prompt += ` Boss: ${config.ownerName}.`;
  }

  // Add business information if configured
  if (config?.businessNiche || config?.clientGoals || config?.offerDetails || config?.importantLinks?.length) {
    prompt += `\n\nBUSINESS:`;
    if (config.businessNiche) prompt += ` Niche: ${config.businessNiche}.`;
    if (config.clientGoals) prompt += ` Goals: ${config.clientGoals}.`;
    if (config.offerDetails) prompt += ` Offer: ${config.offerDetails}.`;
    if (config.importantLinks && config.importantLinks.length > 0) {
      prompt += ` Important links: ${config.importantLinks.join(', ')}.`;
    }
  }

  // Add opening question if configured (for first contact)
  if (config?.openingQuestion) {
    prompt += `\n\nOPENING: When starting a new conversation, use this opening: "${config.openingQuestion}"`;
  }

  // Add lead qualification settings if enabled
  if (config?.enableQualification === true) {
    prompt += `\n\nLEAD QUALIFICATION:`;
    if (config.qualifyingQuestion) {
      prompt += ` Key question to ask: "${config.qualifyingQuestion}"`;
    }
    if (config.qualificationCriteria) {
      prompt += ` Criteria to qualify: ${config.qualificationCriteria}`;
    }
    if (config.disqualifyMessage) {
      prompt += ` If lead doesn't qualify, respond with: "${config.disqualifyMessage}"`;
    }
  }

  // Add tone guidelines if configured
  if (config?.toneGuidelines) {
    prompt += `\n\nSTYLE: ${config.toneGuidelines}`;
  }

  // Add additional context if exists
  if (config?.additionalContext) {
    prompt += `\n\nCONTEXT: ${config.additionalContext}`;
  }

  // Add conversation examples if they exist
  if (config?.conversationExamples) {
    prompt += `\n\nEXAMPLES:\n${config.conversationExamples}`;
  }

  // Add knowledge bases content if available
  if (knowledgeBases && knowledgeBases.length > 0) {
    prompt += `\n\nKNOWLEDGE BASE (use this information to answer questions):\n${knowledgeBases.join('\n\n')}`;
  }

  // If there's saved context about the contact, include it
  if (contactContext) {
    prompt += `\n\nMEMORY ABOUT THIS LEAD: ${contactContext}`;
  }

  // If calendar capabilities are enabled, add minimal context
  if (config?.enableMeetingScheduling === true) {
    const now = new Date();
    const timezone = config?.meetingTimezone || 'America/Argentina/Buenos_Aires';
    const currentDateTime = now.toLocaleString('en-US', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const workDays = config?.meetingAvailableDays?.length > 0
      ? config.meetingAvailableDays.join(', ')
      : 'monday, tuesday, wednesday, thursday, friday';
    const duration = config?.meetingDuration || 30;

    prompt += `\n\nCALENDAR: Now is ${currentDateTime} (${timezone}). Work hours: ${config?.meetingAvailableHoursStart || '09:00'}-${config?.meetingAvailableHoursEnd || '18:00'}. Work days: ${workDays}. Meeting duration: ${duration} minutes. Use check_availability before proposing times. Ask for email before scheduling.`;
  }

  // Simple rules at the end (SAME AS INSTAGRAM WEBHOOK)
  prompt += `

FLUJO DE CONVERSACIÓN:
- NO intentes agendar una llamada ni calificar al lead de inmediato
- Primero ten una conversación natural, responde lo que te pregunte
- Solo cuando el lead muestre interés genuino en lo que vendes, empieza a calificar
- Si ya llevas varios mensajes y el lead no ha dicho por qué te escribe, ahí puedes preguntar casualmente "por cierto, en qué te puedo ayudar?" o "qué te trajo por acá?"
- Deja que la conversación fluya, no fuerces la venta

ESTILO:
- Habla como un amigo por Instagram, casual y directo
- Respuestas cortas la mayoría del tiempo (5-15 palabras)
- Si necesitas explicar algo, puedes usar 2-3 oraciones
- IMPORTANTE: Siempre usa punto (.) al final de cada oración antes de empezar otra
- Sin emojis
- Nunca preguntes "quieres saber más?" ni "te ayudo en algo más?"
- Solo usa ? (nunca ¿)

Ejemplo correcto: "listo, quedó agendada. te llegó el mail?"
Ejemplo incorrecto: "listo, quedó agendada te llegó el mail?"`;

  return prompt;
}

Deno.serve(async (req: Request) => {
  // CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { agent_id, agent_name, description, user_message, conversation_history, config } = await req.json();

    if (!user_message) {
      return new Response(
        JSON.stringify({ error: 'user_message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!GOOGLE_AI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Google AI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch knowledge bases if agent_id is provided
    let knowledgeBases: string[] = [];
    if (agent_id) {
      knowledgeBases = await getAgentKnowledgeBases(agent_id);
    }

    // Build system prompt with EXACT same logic as Instagram webhook
    const systemPrompt = buildSystemPrompt(
      agent_name || 'Asistente',
      description || '',
      config,
      null, // No contact context for test
      knowledgeBases
    );

    console.log('[test-agent] System prompt length:', systemPrompt.length);
    console.log('[test-agent] First 500 chars:', systemPrompt.substring(0, 500));

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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GOOGLE_AI_API_KEY}`,
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
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    let content = candidate?.content?.parts?.map((p: any) => p.text).join('') || '';

    console.log('[test-agent] Response generated successfully');

    // Split response on . and ? to send as separate messages (same as Instagram production)
    // Keep the ? at the end of questions, remove trailing periods
    // IMPORTANT: Only split after . if followed by space (to avoid splitting domains like setterapp.ai)
    const messageParts = content
      .split(/(?<=\?)\s*|(?<=\.)\s+/)  // Split after ? or . (. only if followed by space)
      .map((msg: string) => msg.trim().replace(/\.$/, ''))  // Remove trailing periods
      .filter((msg: string) => msg.length > 0);

    console.log(`[test-agent] Split into ${messageParts.length} message(s)`);

    // NOTE: This is a TEST - no message credits are counted, no messages are saved to DB

    return new Response(
      JSON.stringify({
        content: messageParts.length === 1 ? messageParts[0] : content,
        messages: messageParts,  // Array of split messages for UI
        model: 'gemini-3-flash-preview'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[test-agent] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } }
    );
  }
});
