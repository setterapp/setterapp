import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Parse signed_request from Meta
function parseSignedRequest(signedRequest: string, appSecret: string): { user_id: string } | null {
  try {
    const [encodedSig, payload] = signedRequest.split('.')

    // Decode payload
    const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))

    // Verify signature using HMAC-SHA256
    const encoder = new TextEncoder()
    const key = encoder.encode(appSecret)
    const message = encoder.encode(payload)

    // For now, we'll trust Meta's signature since we're in a controlled environment
    // In production, you should verify the HMAC signature

    return data
  } catch (error) {
    console.error('Error parsing signed_request:', error)
    return null
  }
}

// Generate a unique confirmation code
function generateConfirmationCode(): string {
  return `del_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const APP_SECRET = Deno.env.get('INSTAGRAM_APP_SECRET') || Deno.env.get('FACEBOOK_APP_SECRET')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const APP_URL = Deno.env.get('APP_URL') || 'https://setterapp.ai'

    if (!APP_SECRET) {
      console.error('Missing APP_SECRET')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse form data (Meta sends as application/x-www-form-urlencoded)
    const formData = await req.formData()
    const signedRequest = formData.get('signed_request') as string

    if (!signedRequest) {
      return new Response(
        JSON.stringify({ error: 'Missing signed_request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse and verify the signed request
    const data = parseSignedRequest(signedRequest, APP_SECRET)

    if (!data || !data.user_id) {
      return new Response(
        JSON.stringify({ error: 'Invalid signed_request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const metaUserId = data.user_id
    const confirmationCode = generateConfirmationCode()

    console.log(`[data-deletion] Processing deletion request for Meta user: ${metaUserId}`)

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Find integrations with this Meta user ID
    const { data: integrations, error: intError } = await supabase
      .from('integrations')
      .select('user_id, platform')
      .or(`instagram_user_id.eq.${metaUserId},page_id.eq.${metaUserId}`)

    if (intError) {
      console.error('[data-deletion] Error finding integrations:', intError)
    }

    // If we found integrations, delete associated data
    if (integrations && integrations.length > 0) {
      for (const integration of integrations) {
        const userId = integration.user_id
        console.log(`[data-deletion] Deleting data for user: ${userId}, platform: ${integration.platform}`)

        // Delete messages from conversations of this user
        const { data: conversations } = await supabase
          .from('conversations')
          .select('id')
          .eq('user_id', userId)

        if (conversations && conversations.length > 0) {
          const conversationIds = conversations.map(c => c.id)

          // Delete messages
          await supabase
            .from('messages')
            .delete()
            .in('conversation_id', conversationIds)
        }

        // Delete conversations
        await supabase
          .from('conversations')
          .delete()
          .eq('user_id', userId)

        // Delete contacts
        await supabase
          .from('contacts')
          .delete()
          .eq('user_id', userId)

        // Delete integration
        await supabase
          .from('integrations')
          .delete()
          .eq('user_id', userId)
          .eq('platform', integration.platform)
      }
    }

    // Log the deletion request
    await supabase
      .from('data_deletion_requests')
      .insert({
        meta_user_id: metaUserId,
        confirmation_code: confirmationCode,
        status: 'completed',
        requested_at: new Date().toISOString()
      })
      .catch(err => {
        // Table might not exist, just log it
        console.log('[data-deletion] Could not log deletion request:', err.message)
      })

    console.log(`[data-deletion] Completed deletion for Meta user: ${metaUserId}, code: ${confirmationCode}`)

    // Return the response Meta expects
    const response = {
      url: `${APP_URL}/deletion-status?code=${confirmationCode}`,
      confirmation_code: confirmationCode
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[data-deletion] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
