import { supabase } from '../lib/supabase'

/**
 * Instagram Business OAuth Service
 * Handles authentication through Facebook OAuth for Instagram Business API
 *
 * IMPORTANT: Instagram Business API requires Facebook OAuth, not direct Instagram OAuth.
 * The user must have an Instagram Business Account linked to a Facebook Page.
 *
 * Configuration required in Meta Developers:
 * 1. Go to Meta Developers → Your App → Settings → Basic
 * 2. Add your redirect URI to "Valid OAuth Redirect URIs"
 *    Example: https://yourdomain.com/auth/instagram/callback
 * 3. Make sure the redirect URI matches EXACTLY (including protocol, domain, and path)
 */

// Facebook/Instagram OAuth configuration
// These should be set in your Meta App settings
const INSTAGRAM_APP_ID = import.meta.env.VITE_INSTAGRAM_APP_ID || '1206229924794990'
const INSTAGRAM_APP_SECRET = import.meta.env.VITE_INSTAGRAM_APP_SECRET || ''
// Use the actual domain - this must match EXACTLY what's configured in Meta Developers → Settings → Basic → Valid OAuth Redirect URIs
const INSTAGRAM_REDIRECT_URI = import.meta.env.VITE_INSTAGRAM_REDIRECT_URI || `${window.location.origin}/auth/instagram/callback`

// Scopes for Instagram Business API
const INSTAGRAM_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
  'instagram_business_content_publish',
  'instagram_business_manage_insights',
]

export const instagramDirectService = {
  /**
   * Initiate Facebook OAuth flow for Instagram Business API
   * This opens Facebook login in a popup window
   * The user must have an Instagram Business Account linked to a Facebook Page
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

      console.log('🔗 Iniciando Facebook OAuth para Instagram Business...', {
        userId: currentSession.user.id,
        userEmail: currentSession.user.email,
        redirectUri: actualRedirectUri,
        windowOrigin: window.location.origin,
        hasEnvVar: !!import.meta.env.VITE_INSTAGRAM_REDIRECT_URI
      })

      // ⚠️ IMPORTANT: Log the exact redirect URI that will be sent to Facebook
      console.log('⚠️ REDIRECT URI QUE SE ESTÁ ENVIANDO:', actualRedirectUri)
      console.log('⚠️ Este URI DEBE estar configurado EXACTAMENTE en Meta Developers')
      console.log('⚠️ El URI debe coincidir exactamente (protocolo, dominio, puerto, path, sin trailing slash)')

      // Validate redirect URI format
      try {
        const redirectUrl = new URL(actualRedirectUri)
        console.log('✅ Redirect URI válido:', {
          protocol: redirectUrl.protocol,
          host: redirectUrl.host,
          hostname: redirectUrl.hostname,
          port: redirectUrl.port || '(default)',
          pathname: redirectUrl.pathname,
          full: actualRedirectUri
        })
      } catch (e) {
        console.error('❌ Redirect URI inválido:', actualRedirectUri)
        throw new Error(`Redirect URI inválido: ${actualRedirectUri}`)
      }

      // Generate state for CSRF protection
      const state = crypto.randomUUID()

      // Store state in sessionStorage to verify on callback
      sessionStorage.setItem('instagram_oauth_state', state)
      sessionStorage.setItem('instagram_oauth_user_id', currentSession.user.id)

      // Build Facebook OAuth URL for Instagram Business API
      // Instagram Business API requires Facebook OAuth, not direct Instagram OAuth
      const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth')
      authUrl.searchParams.set('redirect_uri', actualRedirectUri)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', INSTAGRAM_SCOPES.join(','))
      authUrl.searchParams.set('state', state)
      authUrl.searchParams.set('client_id', INSTAGRAM_APP_ID)
      authUrl.searchParams.set('auth_type', 'rerequest') // Force re-authentication

      console.log('🔗 Instagram OAuth URL completa:', authUrl.toString())
      console.log('⚠️ URL completa que se enviará a Facebook:', authUrl.toString())
      console.log('🔍 Parámetros de la URL:', {
        redirect_uri: authUrl.searchParams.get('redirect_uri'),
        client_id: authUrl.searchParams.get('client_id'),
        scope: authUrl.searchParams.get('scope')
      })

      // Use the auth URL directly (Business Login method)
      // No need for intermediate login URL redirect

      console.log('✅ Abriendo Facebook OAuth para Instagram Business en popup...', authUrl.toString())

      // Open in popup window
      const width = 600
      const height = 700
      const left = (window.screen.width / 2) - (width / 2)
      const top = (window.screen.height / 2) - (height / 2)

      const popup = window.open(
        authUrl.toString(),
        'Facebook Login - Instagram Business',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes,location=no,directories=no,status=no`
      )

      if (!popup) {
        throw new Error('No se pudo abrir la ventana popup. Por favor, permite ventanas emergentes para este sitio.')
      }

      // Listen for the callback using postMessage
      // The callback page will send a message when it loads
      return new Promise((resolve, reject) => {
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
            if (!popup.closed) {
              popup.close()
            }
            resolve({ code: event.data.code, url: event.data.url })
          } else if (event.data && event.data.type === 'instagram_oauth_error') {
            window.removeEventListener('message', messageHandler)
            if (!popup.closed) {
              popup.close()
            }
            reject(new Error(event.data.error || 'Error al autorizar con Instagram'))
          }
        }

        window.addEventListener('message', messageHandler)

        // Also poll for popup being closed
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed)
            window.removeEventListener('message', messageHandler)
            reject(new Error('La ventana de autorización fue cerrada'))
          }
        }, 500)

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(checkClosed)
          window.removeEventListener('message', messageHandler)
          if (!popup.closed) {
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
   */
  async exchangeCodeForToken(code: string) {
    try {
      // Use Facebook Graph API to exchange code for token
      // Instagram Business API tokens are obtained through Facebook OAuth
      const response = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: INSTAGRAM_APP_ID,
          client_secret: INSTAGRAM_APP_SECRET,
          redirect_uri: INSTAGRAM_REDIRECT_URI,
          code: code,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ Error response from Facebook:', errorData)
        throw new Error(errorData.error?.message || errorData.error_message || 'Error al intercambiar código por token')
      }

      const data = await response.json()

      // Facebook Graph API returns access_token directly
      // We need to get Instagram user info separately
      if (data.access_token) {
        // Try to get Instagram Business Account info
        // Note: This requires the user to have an Instagram Business Account linked to their Facebook Page
        try {
          // First, get user's pages
          const pagesResponse = await fetch(
            `https://graph.facebook.com/v18.0/me/accounts?access_token=${data.access_token}`
          )

          if (pagesResponse.ok) {
            const pagesData = await pagesResponse.json()
            if (pagesData.data && pagesData.data.length > 0) {
              // Get Instagram Business Account from first page
              const pageId = pagesData.data[0].id
              const instagramResponse = await fetch(
                `https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account&access_token=${data.access_token}`
              )

              if (instagramResponse.ok) {
                const instagramData = await instagramResponse.json()
                if (instagramData.instagram_business_account) {
                  const igAccountId = instagramData.instagram_business_account.id
                  // Get Instagram account details
                  const igDetailsResponse = await fetch(
                    `https://graph.facebook.com/v18.0/${igAccountId}?fields=username,id&access_token=${data.access_token}`
                  )

                  if (igDetailsResponse.ok) {
                    const igDetails = await igDetailsResponse.json()
                    return {
                      access_token: data.access_token,
                      user_id: igDetails.id,
                      username: igDetails.username,
                    }
                  }
                }
              }
            }
          }
        } catch (igError) {
          console.warn('⚠️ Could not fetch Instagram Business Account info:', igError)
          // Return token anyway, user can connect later
        }

        // Return token even if we couldn't get Instagram account info
        return {
          access_token: data.access_token,
          user_id: data.user_id || null,
          username: data.username || null,
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
  }
}
