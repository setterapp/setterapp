/**
 * Google OAuth 2.0 Direct Implementation (sin Supabase Auth)
 *
 * Implementa el flujo OAuth 2.0 Authorization Code con PKCE directamente con Google
 * para evitar las limitaciones de Supabase Auth con scopes sensibles como Calendar.
 *
 * Referencias:
 * - https://developers.google.com/identity/protocols/oauth2/web-server
 * - https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow
 */

const GOOGLE_OAUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke'

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
]

/**
 * Genera un string aleatorio para usar como state o code_verifier
 */
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(values)
    .map(x => possible[x % possible.length])
    .join('')
}

/**
 * Genera el code_challenge a partir del code_verifier usando SHA-256
 */
async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const digest = await crypto.subtle.digest('SHA-256', data)

  // Convertir a base64url
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export const googleOAuthDirect = {
  /**
   * Inicia el flujo OAuth con Google usando PKCE
   * Este método redirige al usuario a Google para autorización
   */
  async initiateOAuth() {
    try {
      console.log('[GoogleOAuthDirect] Initiating OAuth flow with PKCE')

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
      if (!clientId) {
        throw new Error('VITE_GOOGLE_CLIENT_ID not configured')
      }

      // Generar state para protección CSRF
      const state = generateRandomString(32)
      sessionStorage.setItem('google_oauth_state', state)

      // Generar code_verifier y code_challenge para PKCE
      const codeVerifier = generateRandomString(128)
      sessionStorage.setItem('google_code_verifier', codeVerifier)

      const codeChallenge = await generateCodeChallenge(codeVerifier)

      // Construir URL de autorización
      const redirectUri = `${window.location.origin}/auth/google-calendar/callback`

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: CALENDAR_SCOPES.join(' '),
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        access_type: 'offline', // Para obtener refresh_token
        prompt: 'consent' // Forzar pantalla de consentimiento para obtener refresh_token
      })

      const authUrl = `${GOOGLE_OAUTH_ENDPOINT}?${params.toString()}`

      console.log('[GoogleOAuthDirect] Redirecting to Google OAuth:', {
        redirectUri,
        scopes: CALENDAR_SCOPES,
        hasCodeChallenge: !!codeChallenge
      })

      // Redirigir a Google
      window.location.href = authUrl
    } catch (error) {
      console.error('[GoogleOAuthDirect] Error initiating OAuth:', error)
      throw error
    }
  },

  /**
   * Intercambia el código de autorización por tokens de acceso
   * Se llama desde el callback después de que Google redirige de vuelta
   */
  async exchangeCodeForTokens(code: string, state: string) {
    try {
      console.log('[GoogleOAuthDirect] Exchanging code for tokens')

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
      const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET

      if (!clientId || !clientSecret) {
        throw new Error('Google OAuth credentials not configured')
      }

      // Verificar state para protección CSRF
      const savedState = sessionStorage.getItem('google_oauth_state')
      if (state !== savedState) {
        throw new Error('Invalid state parameter - possible CSRF attack')
      }

      // Recuperar code_verifier
      const codeVerifier = sessionStorage.getItem('google_code_verifier')
      if (!codeVerifier) {
        throw new Error('Code verifier not found')
      }

      const redirectUri = `${window.location.origin}/auth/google-calendar/callback`

      // Intercambiar código por tokens
      const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: codeVerifier
        }).toString()
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('[GoogleOAuthDirect] Token exchange failed:', errorData)
        throw new Error(`Failed to exchange code for tokens: ${errorData.error || response.statusText}`)
      }

      const tokens = await response.json()

      console.log('[GoogleOAuthDirect] Tokens obtained successfully:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiresIn: tokens.expires_in,
        scope: tokens.scope
      })

      // Limpiar sessionStorage
      sessionStorage.removeItem('google_oauth_state')
      sessionStorage.removeItem('google_code_verifier')

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
        scope: tokens.scope,
        tokenType: tokens.token_type
      }
    } catch (error) {
      console.error('[GoogleOAuthDirect] Error exchanging code:', error)
      throw error
    }
  },

  /**
   * Refresca el access token usando el refresh token
   */
  async refreshAccessToken(refreshToken: string) {
    try {
      console.log('[GoogleOAuthDirect] Refreshing access token')

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
      const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET

      if (!clientId || !clientSecret) {
        throw new Error('Google OAuth credentials not configured')
      }

      const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        }).toString()
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('[GoogleOAuthDirect] Token refresh failed:', errorData)
        throw new Error(`Failed to refresh token: ${errorData.error || response.statusText}`)
      }

      const tokens = await response.json()

      console.log('[GoogleOAuthDirect] Token refreshed successfully')

      return {
        accessToken: tokens.access_token,
        expiresIn: tokens.expires_in,
        scope: tokens.scope,
        tokenType: tokens.token_type
      }
    } catch (error) {
      console.error('[GoogleOAuthDirect] Error refreshing token:', error)
      throw error
    }
  },

  /**
   * Revoca el token de acceso
   */
  async revokeToken(token: string) {
    try {
      console.log('[GoogleOAuthDirect] Revoking token')

      const response = await fetch(GOOGLE_REVOKE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ token }).toString()
      })

      // Google devuelve 200 si el token se revocó exitosamente
      // O 400 si el token ya estaba revocado/inválido (lo cual está bien para nosotros)
      if (response.status === 200 || response.status === 400) {
        console.log('[GoogleOAuthDirect] Token revoked successfully')
        return true
      }

      throw new Error(`Failed to revoke token: ${response.statusText}`)
    } catch (error) {
      console.error('[GoogleOAuthDirect] Error revoking token:', error)
      // No lanzar error - la revocación no es crítica
      return false
    }
  }
}
