import { supabase } from '../lib/supabase'

/**
 * Facebook OAuth Service
 * Se usa DESPUÉS de conectar Instagram para obtener el Page Access Token
 * que necesitamos para la User Profile API (obtener usernames de leads)
 */

const normalizeAppId = (v?: string) => {
  if (!v) return ''
  const trimmed = v.trim()
  // Some environments may provide values wrapped in quotes
  return trimmed.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1').trim()
}

// Prefer explicit Facebook App ID, fallback to Instagram App ID for backwards compatibility
const FACEBOOK_APP_ID = normalizeAppId(import.meta.env.VITE_FACEBOOK_APP_ID || import.meta.env.VITE_INSTAGRAM_APP_ID) || '1206229924794990'
const FACEBOOK_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'instagram_basic',
  'instagram_manage_messages',
]

const getRedirectUri = () => {
  if (import.meta.env.VITE_FACEBOOK_REDIRECT_URI) {
    return import.meta.env.VITE_FACEBOOK_REDIRECT_URI
  }
  return `${window.location.origin}/auth/facebook/callback`
}

export const facebookOAuthService = {
  /**
   * Inicia el flujo de OAuth de Facebook
   * Se abre en popup para obtener el Page Access Token
   * Crea una integración de Facebook separada
   */
  async connectFacebook(): Promise<{ code: string; url: string }> {
    try {
      // Verificar que el usuario está autenticado
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !currentSession) {
        throw new Error('Debes iniciar sesión primero')
      }

      const redirectUri = getRedirectUri()

      // Validar App ID
      if (!FACEBOOK_APP_ID || FACEBOOK_APP_ID.trim() === '') {
        throw new Error('Facebook App ID no configurado. Configura VITE_FACEBOOK_APP_ID (recomendado) o VITE_INSTAGRAM_APP_ID en tu .env / entorno.')
      }
      if (!/^\d+$/.test(FACEBOOK_APP_ID)) {
        throw new Error(`Facebook App ID inválido: "${FACEBOOK_APP_ID}". Debe ser numérico (Meta Developers → Settings → Basic → App ID).`)
      }

      // Validar redirect URI
      try {
        new URL(redirectUri)
      } catch (e) {
        throw new Error(`Redirect URI inválido: ${redirectUri}`)
      }

      // Generar state para CSRF protection
      const state = crypto.randomUUID()

      // Guardar state y user ID en localStorage
      localStorage.setItem('facebook_oauth_state', state)
      localStorage.setItem('facebook_oauth_user_id', currentSession.user.id)

      // Construir URL de OAuth de Facebook
      const authUrl = new URL('https://www.facebook.com/v24.0/dialog/oauth')
      authUrl.searchParams.set('client_id', FACEBOOK_APP_ID)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('state', state)
      authUrl.searchParams.set('scope', FACEBOOK_SCOPES.join(','))
      authUrl.searchParams.set('response_type', 'code')


      // Abrir en popup
      const width = 600
      const height = 700
      const left = (window.screen.width / 2) - (width / 2)
      const top = (window.screen.height / 2) - (height / 2)

      const popup = window.open(
        authUrl.toString(),
        'Facebook Login',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes,location=no,directories=no,status=no`
      )

      if (!popup) {
        throw new Error('No se pudo abrir la ventana popup. Por favor, permite ventanas emergentes.')
      }

      // Escuchar el mensaje del callback
      return new Promise((resolve, reject) => {
        let checkRedirect: ReturnType<typeof setInterval> | undefined = undefined

        const messageHandler = (event: MessageEvent) => {
          const allowedOrigins = [
            window.location.origin,
            window.location.protocol + '//' + window.location.host,
            window.location.protocol + '//' + window.location.hostname,
          ]

          if (!allowedOrigins.some(origin => event.origin === origin || event.origin.includes(window.location.hostname))) {
            return
          }

          if (event.data && event.data.type === 'facebook_oauth_success') {
            window.removeEventListener('message', messageHandler)
            if (checkRedirect !== undefined) {
              clearInterval(checkRedirect)
            }
            if (popup && !popup.closed) {
              popup.close()
            }
            resolve({ code: event.data.code, url: event.data.url })
          } else if (event.data && event.data.type === 'facebook_oauth_error') {
            window.removeEventListener('message', messageHandler)
            if (checkRedirect !== undefined) {
              clearInterval(checkRedirect)
            }
            if (popup && !popup.closed) {
              popup.close()
            }
            reject(new Error(event.data.error || 'Error al autorizar con Facebook'))
          }
        }

        window.addEventListener('message', messageHandler)

        // Polling para detectar cierre del popup
        checkRedirect = setInterval(() => {
          try {
            if (popup.closed) {
              if (checkRedirect !== undefined) {
                clearInterval(checkRedirect)
              }
              window.removeEventListener('message', messageHandler)
              return
            }

            try {
              const popupUrl = popup.location.href
              if (popupUrl.includes(window.location.hostname)) {
                // El callback debería manejar el cierre
              }
            } catch (e) {
              // Cross-origin error es esperado
            }
          } catch (e) {
            // Ignorar errores
          }
        }, 500)

        // Timeout después de 5 minutos
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
      console.error('❌ Error connecting Facebook:', error)
      throw error
    }
  },

  /**
   * Intercambia el código de autorización por tokens
   * Y obtiene el Page Access Token
   */
  async exchangeCodeForPageToken(code: string): Promise<{
    pageAccessToken: string
    pageId: string
    instagramBusinessAccountId: string
    instagramUsername?: string
  }> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL no está configurado')
      }

      // Llamar a Edge Function para intercambiar código por token
      const response = await fetch(`${supabaseUrl}/functions/v1/facebook-exchange-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
        },
        body: JSON.stringify({
          code: code,
          redirect_uri: getRedirectUri(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ Error response from Edge Function:', errorData)
        throw new Error(errorData.error || 'Error al intercambiar código por token')
      }

      const data = await response.json()

      if (!data.pageAccessToken || !data.pageId || !data.instagramBusinessAccountId) {
        throw new Error('No se pudo obtener Page Access Token o Instagram Business Account ID')
      }

      return {
        pageAccessToken: data.pageAccessToken,
        pageId: data.pageId,
        instagramBusinessAccountId: data.instagramBusinessAccountId,
        instagramUsername: data.instagramUsername,
      }
    } catch (error) {
      console.error('❌ Error exchanging code for page token:', error)
      throw error
    }
  },

  /**
   * Crea una integración de Facebook con el Page Access Token
   */
  async createFacebookIntegration(
    userId: string,
    pageData: {
      pageAccessToken: string
      pageId: string
      instagramBusinessAccountId: string
      instagramUsername?: string
      pageName?: string
    }
  ) {
    try {
      // Verificar si ya existe una integración de Facebook para este usuario
      const { data: existingIntegration } = await supabase
        .from('integrations')
        .select('id, config')
        .eq('user_id', userId)
        .eq('type', 'facebook')
        .maybeSingle()

      if (existingIntegration) {
        // Actualizar la integración existente
        const { error: updateError } = await supabase
          .from('integrations')
          .update({
            status: 'connected',
            config: {
              ...(existingIntegration.config || {}),
              page_access_token: pageData.pageAccessToken,
              page_id: pageData.pageId,
              instagram_business_account_id: pageData.instagramBusinessAccountId,
              instagram_username: pageData.instagramUsername,
              page_name: pageData.pageName,
              connected_at: new Date().toISOString(),
            }
          })
          .eq('id', existingIntegration.id)

        if (updateError) {
          throw updateError
        }

        return existingIntegration.id
      } else {
        // Crear nueva integración de Facebook
        const { data: newIntegration, error: insertError } = await supabase
          .from('integrations')
          .insert({
            user_id: userId,
            type: 'facebook',
            status: 'connected',
            config: {
              page_access_token: pageData.pageAccessToken,
              page_id: pageData.pageId,
              instagram_business_account_id: pageData.instagramBusinessAccountId,
              instagram_username: pageData.instagramUsername,
              page_name: pageData.pageName,
              connected_at: new Date().toISOString(),
            }
          })
          .select('id')
          .single()

        if (insertError) {
          throw insertError
        }

        return newIntegration.id
      }
    } catch (error) {
      console.error('❌ Error creating/updating Facebook integration:', error)
      throw error
    }
  },
}
