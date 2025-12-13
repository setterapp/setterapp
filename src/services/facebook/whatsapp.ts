import { supabase } from '../../lib/supabase'

/**
 * Facebook/WhatsApp Business OAuth Service
 * Handles authentication and WhatsApp Business operations using Facebook OAuth
 *
 * IMPORTANTE: WhatsApp Business API también usa la API de Facebook/Meta,
 * por lo que podemos usar el mismo OAuth que Instagram.
 */

// Scopes necesarios para WhatsApp Business
const WHATSAPP_SCOPES = [
  'whatsapp_business_management', // Gestionar WhatsApp Business
  'whatsapp_business_messaging',   // Enviar y recibir mensajes
  'business_management',          // Gestionar negocio
  'pages_read_engagement',        // Leer engagement de páginas
  'pages_messaging',              // Enviar mensajes
  'pages_show_list',              // Listar páginas conectadas
]

export const whatsappService = {
  /**
   * Initiate Facebook OAuth flow for WhatsApp Business access
   *
   * IMPORTANTE: Este método redirige al usuario a Facebook para autorizar.
   * Si el usuario ya está autenticado en tu app, Supabase vinculará el token
   * de Facebook a su sesión actual.
   */
  async connectWhatsApp() {
    try {
      // Verificar que el usuario ya esté autenticado en tu app
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !currentSession) {
        throw new Error('Debes iniciar sesión primero antes de conectar WhatsApp')
      }

      console.log('🔗 Iniciando OAuth de Facebook para WhatsApp Business...', {
        userId: currentSession.user.id,
        userEmail: currentSession.user.email
      })

      // Iniciar OAuth con Facebook
      // Supabase vinculará el token de Facebook a la sesión actual del usuario
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          scopes: WHATSAPP_SCOPES.join(','),
          redirectTo: `${window.location.origin}/auth/callback?redirect_to=/integrations&provider=facebook&integration=whatsapp`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent', // Forzar consentimiento para obtener todos los permisos
          },
          skipBrowserRedirect: false,
        }
      })

      if (error) {
        console.error('❌ Error en connectWhatsApp:', error)
        throw error
      }

      if (!data.url) {
        console.warn('⚠️ No se obtuvo URL de redirección.')
        throw new Error('No se pudo obtener la URL de autorización de Facebook')
      }

      console.log('✅ Redirigiendo a Facebook OAuth para WhatsApp...')
      return data
    } catch (error) {
      console.error('❌ Error connecting WhatsApp:', error)
      throw error
    }
  },

  /**
   * Get the current Facebook access token from Supabase session
   */
  async getAccessToken() {
    try {
      let { data: { session }, error } = await supabase.auth.getSession()

      if (error) throw error
      if (!session) throw new Error('No active session')

      let providerToken = session.provider_token
      const providerRefreshToken = session.provider_refresh_token

      // Si no hay token, intentar refrescar la sesión
      if (!providerToken) {
        if (providerRefreshToken) {
          console.log('🔄 Token no encontrado, refrescando sesión...')
          try {
            const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()

            if (refreshError) {
              console.error('Error refreshing session:', refreshError)
              throw new Error('No se pudo refrescar el token. Por favor, reconecta WhatsApp.')
            }

            if (refreshedSession?.provider_token) {
              providerToken = refreshedSession.provider_token
            } else {
              throw new Error('No hay token de acceso de Facebook después del refresco. Por favor, reconecta WhatsApp desde la página de Integraciones.')
            }
          } catch (refreshErr: any) {
            throw new Error(refreshErr.message || 'No se pudo obtener el token de Facebook. Por favor, reconecta WhatsApp.')
          }
        } else {
          throw new Error('No hay token de acceso de Facebook. Por favor, reconecta WhatsApp desde la página de Integraciones.')
        }
      }

      return {
        accessToken: providerToken,
        refreshToken: providerRefreshToken
      }
    } catch (error) {
      throw error
    }
  },

  /**
   * Get user's WhatsApp Business Account
   * Necesitas tener una página de Facebook conectada a tu cuenta de WhatsApp Business
   */
  async getWhatsAppBusinessAccount(pageId?: string) {
    try {
      const { accessToken } = await this.getAccessToken()

      // Si no se proporciona pageId, obtener la primera página del usuario
      if (!pageId) {
        const pagesResponse = await fetch(
          `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
        )

        if (!pagesResponse.ok) {
          throw new Error('No se pudieron obtener las páginas de Facebook')
        }

        const pagesData = await pagesResponse.json()
        if (!pagesData.data || pagesData.data.length === 0) {
          throw new Error('No tienes páginas de Facebook conectadas. Necesitas una página para usar WhatsApp Business.')
        }

        pageId = pagesData.data[0].id
      }

      // Obtener el WhatsApp Business Account ID de la página
      const whatsappResponse = await fetch(
        `https://graph.facebook.com/v18.0/${pageId}?fields=whatsapp_business_account&access_token=${accessToken}`
      )

      if (!whatsappResponse.ok) {
        throw new Error('No se pudo obtener la cuenta de WhatsApp Business')
      }

      const whatsappData = await whatsappResponse.json()

      if (!whatsappData.whatsapp_business_account) {
        throw new Error('Esta página de Facebook no tiene una cuenta de WhatsApp Business conectada.')
      }

      return {
        pageId,
        whatsappBusinessAccountId: whatsappData.whatsapp_business_account.id,
        phoneNumberId: whatsappData.whatsapp_business_account.phone_number_id
      }
    } catch (error) {
      throw error
    }
  },

  /**
   * Send a message via WhatsApp Business API
   */
  async sendMessage({
    phoneNumberId,
    to,
    message
  }: {
    phoneNumberId: string
    to: string
    message: string
  }) {
    try {
      const { accessToken } = await this.getAccessToken()

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: {
              body: message
            }
          })
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Error al enviar mensaje: ${errorData.error?.message || 'Error desconocido'}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      throw error
    }
  },

  /**
   * Check if user has WhatsApp connected
   */
  async isConnected() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      return !!(session?.provider_token)
    } catch (error) {
      return false
    }
  },

  /**
   * Disconnect WhatsApp
   */
  async disconnect() {
    try {
      // La desconexión real se hace actualizando el estado en la base de datos
      // El token se limpiará cuando el usuario cierre sesión o expire
      return true
    } catch (error) {
      console.log('Disconnect completed (errors ignored):', error)
      return true
    }
  }
}
