import { supabase } from '../lib/supabase'

/**
 * Instagram Direct OAuth Service
 * Handles authentication directly through Instagram OAuth
 *
 * This uses Instagram's direct OAuth endpoint: api.instagram.com/oauth/authorize
 * The redirect URI can be either:
 * - Supabase callback: https://your-project.supabase.co/auth/v1/callback
 * - Local callback: https://yourdomain.com/auth/instagram/callback
 *
 * Configuration required in Meta Developers:
 * 1. Go to Meta Developers → Your App → Settings → Basic
 * 2. Add your redirect URI to "Valid OAuth Redirect URIs"
 *    Example: https://your-project.supabase.co/auth/v1/callback
 *    Or: https://yourdomain.com/auth/instagram/callback
 * 3. Make sure the redirect URI matches EXACTLY (including protocol, domain, and path)
 */

// Instagram OAuth configuration
// These should be set in your Meta App settings
// Note: INSTAGRAM_APP_SECRET is now only used in the Edge Function, not in the client
const INSTAGRAM_APP_ID = import.meta.env.VITE_INSTAGRAM_APP_ID || '1206229924794990'
// Instagram uses direct OAuth (not Supabase OAuth), so always use local callback
// The redirect URI must match EXACTLY what's configured in Meta Developers → Settings → Basic → Valid OAuth Redirect URIs
const getRedirectUri = () => {
  // Use custom redirect URI if explicitly set in env
  if (import.meta.env.VITE_INSTAGRAM_REDIRECT_URI) {
    return import.meta.env.VITE_INSTAGRAM_REDIRECT_URI
  }
  // Instagram OAuth direct always uses local callback (not Supabase callback)
  // Supabase callback is only for Supabase's OAuth flow, not direct Instagram OAuth
  return `${window.location.origin}/auth/instagram/callback`
}
const INSTAGRAM_REDIRECT_URI = getRedirectUri()

// En producción evitamos logs por seguridad. Si falta configuración crítica, se lanzará error al intentar conectar.

// Scopes for Instagram Business API
// Only instagram_business_* scopes work with Instagram Business Login
const INSTAGRAM_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
]

export const instagramDirectService = {
  /**
   * Initiate Instagram direct OAuth flow
   * This opens Instagram login in a popup window
   * Uses the direct Instagram OAuth endpoint as provided in Meta Developers setup
   */
  async connectInstagram(): Promise<{ code: string; url: string }> {
    try {
      // Verify user is authenticated in our app first
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !currentSession) {
        throw new Error('Debes iniciar sesión primero antes de conectar Instagram')
      }

      // Determine the actual redirect URI being used
      const actualRedirectUri = INSTAGRAM_REDIRECT_URI

      // Validate App ID before proceeding
      if (!INSTAGRAM_APP_ID || INSTAGRAM_APP_ID.trim() === '') {
        throw new Error('App ID de Instagram no configurado. Por favor, configura VITE_INSTAGRAM_APP_ID en tu archivo .env. Puedes encontrar tu App ID en Meta Developers → Settings → Basic → App ID')
      }

      // Validate redirect URI format
      try {
        new URL(actualRedirectUri)
      } catch (e) {
        throw new Error(`Redirect URI inválido: ${actualRedirectUri}`)
      }

      // Generate state for CSRF protection
      const state = crypto.randomUUID()

      // Store state in localStorage (not sessionStorage) so popup can access it
      localStorage.setItem('instagram_oauth_state', state)
      localStorage.setItem('instagram_oauth_user_id', currentSession.user.id)

      // Build Instagram OAuth URL (direct Instagram OAuth)
      // Use instagram.com OAuth authorize (matches the URL you shared)
      const authUrl = new URL('https://www.instagram.com/oauth/authorize')
      authUrl.searchParams.set('redirect_uri', actualRedirectUri)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', INSTAGRAM_SCOPES.join(','))
      authUrl.searchParams.set('state', state)
      authUrl.searchParams.set('client_id', INSTAGRAM_APP_ID)
      authUrl.searchParams.set('force_reauth', 'true') // Force re-authentication

      // Validate App ID format (should be numeric, typically 15-16 digits)
      if (!/^\d+$/.test(INSTAGRAM_APP_ID)) {
        throw new Error(`App ID inválido: "${INSTAGRAM_APP_ID}". El App ID debe ser numérico y coincidir con el que aparece en Meta Developers → Settings → Basic → App ID`)
      }

      if (INSTAGRAM_APP_ID.length < 10 || INSTAGRAM_APP_ID.length > 20) {
        // Longitud inusual: seguimos, pero sin logs en producción
      }

      // Use the auth URL directly (Business Login method)
      // No need for intermediate login URL redirect

      // Open in popup window
      const width = 600
      const height = 700
      const left = (window.screen.width / 2) - (width / 2)
      const top = (window.screen.height / 2) - (height / 2)

      const popup = window.open(
        authUrl.toString(),
        'Instagram Login',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes,location=no,directories=no,status=no`
      )

      if (!popup) {
        throw new Error('No se pudo abrir la ventana popup. Por favor, permite ventanas emergentes para este sitio.')
      }

      // Listen for the callback using postMessage
      // The callback page will send a message when it loads
      return new Promise((resolve, reject) => {
        // Declare checkRedirect before messageHandler so it's in scope
        let checkRedirect: ReturnType<typeof setInterval> | undefined = undefined

        const messageHandler = (event: MessageEvent) => {
          // Verify origin for security - allow our domain
          const allowedOrigins = [
            window.location.origin,
            window.location.protocol + '//' + window.location.host,
            window.location.protocol + '//' + window.location.hostname,
          ]

          if (!allowedOrigins.some(origin => event.origin === origin || event.origin.includes(window.location.hostname))) {
            return
          }

          if (event.data && event.data.type === 'instagram_oauth_success') {
            window.removeEventListener('message', messageHandler)
            if (checkRedirect !== undefined) {
              clearInterval(checkRedirect)
            }
            // Close popup if still open
            if (popup && !popup.closed) {
              popup.close()
            }
            resolve({ code: event.data.code, url: event.data.url })
          } else if (event.data && event.data.type === 'instagram_oauth_error') {
            window.removeEventListener('message', messageHandler)
            if (checkRedirect !== undefined) {
              clearInterval(checkRedirect)
            }
            // Close popup if still open
            if (popup && !popup.closed) {
              popup.close()
            }
            reject(new Error(event.data.error || 'Error al autorizar con Instagram'))
          }
        }

        window.addEventListener('message', messageHandler)

        // Also poll for popup URL changes (when redirect happens)
        checkRedirect = setInterval(() => {
          try {
            // Check if popup has been redirected to our callback or Supabase callback
            if (popup.closed) {
              if (checkRedirect !== undefined) {
                clearInterval(checkRedirect)
              }
              window.removeEventListener('message', messageHandler)
              // Don't reject if popup closed - it might have closed after success
              return
            }

            // Try to check popup location (may fail due to cross-origin)
            try {
              const popupUrl = popup.location.href
              // If popup is on our domain or Supabase domain, it means redirect happened
              if (popupUrl.includes(window.location.hostname) || popupUrl.includes('supabase.co')) {
                // The callback page should handle closing the popup
                // Just wait for the message
              }
            } catch (e) {
              // Cross-origin error is expected, ignore
            }
          } catch (e) {
            // Ignore errors
          }
        }, 500)

        // Timeout after 5 minutes
        setTimeout(() => {
          if (checkRedirect !== undefined) {
            clearInterval(checkRedirect)
          }
          window.removeEventListener('message', messageHandler)
          if (popup && !popup.closed) {
            popup.close()
          }
          reject(new Error('Tiempo de espera agotado'))
        }, 5 * 60 * 1000)
      })
    } catch (error) {
      console.error('❌ Error connecting Instagram:', error)
      throw error
    }
  },

  /**
   * Exchange authorization code for access token
   * Uses Supabase Edge Function to avoid CORS issues
   */
  async exchangeCodeForToken(code: string) {
    try {
      // Get Supabase URL from environment
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL no está configurado')
      }

      // Call Edge Function to exchange code for token (avoids CORS)
      const response = await fetch(`${supabaseUrl}/functions/v1/instagram-exchange-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
        },
        body: JSON.stringify({
          code: code,
          redirect_uri: INSTAGRAM_REDIRECT_URI,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ Error response from Edge Function:', errorData)
        throw new Error(errorData.error || 'Error al intercambiar código por token')
      }

      const data = await response.json()

      // Instagram OAuth direct endpoint returns access_token, user_id, username, and instagram_business_account_id
      if (data.access_token) {
        return {
          access_token: data.access_token,
          user_id: data.user_id || null,
          username: data.username || null,
          // CRITICAL: instagram_business_account_id is the ID that Meta sends in webhooks (entry.id)
          // This MUST be saved to correctly match incoming webhook messages to the right user
          instagram_business_account_id: data.instagram_business_account_id || null,
          expires_in: data.expires_in || null,
          token_type: data.token_type || null,
        }
      }

      return data
    } catch (error) {
      console.error('❌ Error exchanging code for token:', error)
      throw error
    }
  },

  /**
   * Store Instagram access token in user's integration
   */
  async storeAccessToken(userId: string, accessToken: string, userData: any) {
    try {
      // Find or create Instagram integration
      const { data: integrations, error: findError } = await supabase
        .from('integrations')
        .select('*')
        .eq('type', 'instagram')
        .eq('user_id', userId)
        .limit(1)

      if (findError) {
        throw findError
      }

      const integrationData = {
        user_id: userId,
        type: 'instagram',
        name: 'Instagram',
        status: 'connected',
        connected_at: new Date().toISOString(),
        config: {
          access_token: accessToken,
          instagram_user_id: userData.user_id,
          instagram_username: userData.username,
          // CRITICAL: instagram_business_account_id is the ID that Meta sends in webhooks (entry.id)
          // Without this, webhook messages won't be matched to the correct user
          instagram_business_account_id: userData.instagram_business_account_id || null,
          // Guardar expiry si viene (token long-lived)
          expires_at: userData.expires_in ? (Math.floor(Date.now() / 1000) + Number(userData.expires_in)) : null,
          token_type: userData.token_type || null,
        },
      }

      if (integrations && integrations.length > 0) {
        // Update existing integration
        const { error: updateError } = await supabase
          .from('integrations')
          .update(integrationData)
          .eq('id', integrations[0].id)

        if (updateError) throw updateError
      } else {
        // Create new integration
        const { error: insertError } = await supabase
          .from('integrations')
          .insert(integrationData)

        if (insertError) throw insertError
      }

      return true
    } catch (error) {
      console.error('❌ Error storing access token:', error)
      throw error
    }
  },

  /**
   * Send a message via Instagram Direct API
   * Uses the Instagram Messaging API to send messages
   */
  async sendMessage({
    userId,
    recipientId,
    message,
  }: {
    userId?: string
    recipientId: string
    message: string
  }) {
    try {
      // Get user's Instagram integration to retrieve access token
      let integration
      if (userId) {
        const { data, error } = await supabase
          .from('integrations')
          .select('config')
          .eq('type', 'instagram')
          .eq('user_id', userId)
          .eq('status', 'connected')
          .single()

        if (error) throw new Error(`No se encontró integración de Instagram: ${error.message}`)
        integration = data
      } else {
        // If no userId provided, get the first connected Instagram integration
        const { data, error } = await supabase
          .from('integrations')
          .select('config')
          .eq('type', 'instagram')
          .eq('status', 'connected')
          .limit(1)
          .single()

        if (error) throw new Error(`No se encontró integración de Instagram: ${error.message}`)
        integration = data
      }

      const accessToken = integration?.config?.access_token
      const instagramUserId = integration?.config?.instagram_user_id || integration?.config?.instagram_page_id

      if (!accessToken) {
        throw new Error('No se encontró access token de Instagram. Por favor, reconecta Instagram.')
      }

      if (!instagramUserId) {
        throw new Error('No se encontró Instagram User ID. Por favor, reconecta Instagram.')
      }

      // Send message using Instagram Messaging API
      // https://developers.facebook.com/docs/instagram-api/guides/messaging
      const response = await fetch(
        `https://graph.instagram.com/v21.0/${instagramUserId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipient: {
              id: recipientId
            },
            message: {
              text: message
            }
          })
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Error al enviar mensaje a Instagram: ${errorData.error?.message || response.statusText}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('❌ Error sending Instagram message:', error)
      throw error
    }
  }
}
