import { supabase } from '../lib/supabase'

/**
 * Instagram Direct OAuth Service
 * Handles authentication directly through Instagram OAuth (not Facebook)
 *
 * This uses Instagram's direct OAuth endpoint: instagram.com/oauth/authorize/third_party
 * Based on the competitor's implementation
 */

// Instagram OAuth configuration
// These should be set in your Meta App settings
const INSTAGRAM_APP_ID = import.meta.env.VITE_INSTAGRAM_APP_ID || '893993129727776'
const INSTAGRAM_APP_SECRET = import.meta.env.VITE_INSTAGRAM_APP_SECRET || ''
const INSTAGRAM_REDIRECT_URI = `${window.location.origin}/auth/instagram/callback`

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
   * Initiate Instagram direct OAuth flow
   * This redirects directly to Instagram login (not Facebook)
   */
  async connectInstagram() {
    try {
      // Verify user is authenticated in our app first
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !currentSession) {
        throw new Error('Debes iniciar sesión primero antes de conectar Instagram')
      }

      console.log('🔗 Iniciando OAuth directo de Instagram...', {
        userId: currentSession.user.id,
        userEmail: currentSession.user.email
      })

      // Generate state for CSRF protection
      const state = crypto.randomUUID()

      // Store state in sessionStorage to verify on callback
      sessionStorage.setItem('instagram_oauth_state', state)
      sessionStorage.setItem('instagram_oauth_user_id', currentSession.user.id)

      // Build Instagram OAuth URL
      const authUrl = new URL('https://www.instagram.com/oauth/authorize/third_party')
      authUrl.searchParams.set('redirect_uri', INSTAGRAM_REDIRECT_URI)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', INSTAGRAM_SCOPES.join(','))
      authUrl.searchParams.set('state', state)
      authUrl.searchParams.set('client_id', INSTAGRAM_APP_ID)
      authUrl.searchParams.set('force_reauth', '0')

      // Redirect to Instagram login with enable_fb_login option
      // This allows users to login with Instagram directly OR use Facebook as fallback
      const loginUrl = new URL('https://www.instagram.com/accounts/login/')
      loginUrl.searchParams.set('force_authentication', '')
      loginUrl.searchParams.set('platform_app_id', INSTAGRAM_APP_ID)
      loginUrl.searchParams.set('enable_fb_login', '')
      loginUrl.searchParams.set('next', authUrl.toString())

      console.log('✅ Redirigiendo a Instagram OAuth directo...')
      window.location.href = loginUrl.toString()

      return { url: loginUrl.toString() }
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
      // This should be done server-side for security, but for now we'll try client-side
      // In production, you should create an Edge Function to handle this
      const response = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: INSTAGRAM_APP_ID,
          client_secret: INSTAGRAM_APP_SECRET,
          grant_type: 'authorization_code',
          redirect_uri: INSTAGRAM_REDIRECT_URI,
          code: code,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error_message || 'Error al intercambiar código por token')
      }

      const data = await response.json()
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
