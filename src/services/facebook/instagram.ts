import { supabase } from '../../lib/supabase'
import { instagramDirectService } from '../instagram-direct'

/**
 * Facebook/Instagram OAuth Service
 * Handles authentication and Instagram operations using Instagram Direct OAuth
 *
 * IMPORTANTE: Usamos el método directo de Instagram OAuth que abre el login de Instagram,
 * no el de Facebook. Esto permite conectar cuentas de Instagram que no están vinculadas a Facebook.
 */

// Note: Instagram scopes are now handled by instagram-direct.ts service
// This file maintains backwards compatibility and redirects to the direct OAuth flow

export const instagramService = {
  /**
   * Initiate Instagram direct OAuth flow
   *
   * IMPORTANTE: Este método abre el login de Instagram directamente (no Facebook)
   * en una ventana popup. El usuario puede loguearse con su cuenta de Instagram
   * incluso si no está conectada a Facebook.
   */
  async connectInstagram() {
    try {
      // Verificar que el usuario ya esté autenticado en tu app
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !currentSession) {
        throw new Error('Debes iniciar sesión primero antes de conectar Instagram')
      }

      console.log('🔗 Iniciando OAuth directo de Instagram...', {
        userId: currentSession.user.id,
        userEmail: currentSession.user.email
      })

      // Use Instagram direct OAuth (like competitor)
      // This opens instagram.com/login in a popup window, not Facebook
      return await instagramDirectService.connectInstagram()
    } catch (error) {
      console.error('❌ Error connecting Instagram:', error)
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
              throw new Error('No se pudo refrescar el token. Por favor, reconecta Instagram.')
            }

            if (refreshedSession?.provider_token) {
              providerToken = refreshedSession.provider_token
            } else {
              throw new Error('No hay token de acceso de Facebook después del refresco. Por favor, reconecta Instagram desde la página de Integraciones.')
            }
          } catch (refreshErr: any) {
            throw new Error(refreshErr.message || 'No se pudo obtener el token de Facebook. Por favor, reconecta Instagram.')
          }
        } else {
          throw new Error('No hay token de acceso de Facebook. Por favor, reconecta Instagram desde la página de Integraciones.')
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
   * Get user's Instagram Business Account ID
   * Necesitas tener una página de Facebook conectada a tu cuenta de Instagram Business
   */
  async getInstagramBusinessAccount(pageId?: string) {
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
          throw new Error('No tienes páginas de Facebook conectadas. Necesitas una página para usar Instagram Business.')
        }

        pageId = pagesData.data[0].id
      }

      // Obtener el Instagram Business Account ID de la página
      const instagramResponse = await fetch(
        `https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account&access_token=${accessToken}`
      )

      if (!instagramResponse.ok) {
        throw new Error('No se pudo obtener la cuenta de Instagram Business')
      }

      const instagramData = await instagramResponse.json()

      if (!instagramData.instagram_business_account) {
        throw new Error('Esta página de Facebook no tiene una cuenta de Instagram Business conectada.')
      }

      return {
        pageId,
        instagramBusinessAccountId: instagramData.instagram_business_account.id
      }
    } catch (error) {
      throw error
    }
  },

  /**
   * Check if user has Instagram connected
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
   * Disconnect Instagram
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
