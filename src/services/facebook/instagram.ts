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
      return true
    }
  }

  ,

  /**
   * Get a Page access token + Instagram Business Account linked to that Page.
   * Needed for Instagram Messaging + User Profile API.
   */
  async getInstagramPageAccessToken() {
    const { accessToken } = await this.getAccessToken()

    const res = await fetch(
      `https://graph.facebook.com/v24.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(accessToken)}`
    )

    if (!res.ok) {
      const errorData = await res.json().catch(() => null)
      console.error('❌ Graph API error:', errorData)
      throw new Error(`No se pudieron obtener páginas de Facebook: ${errorData?.error?.message || res.statusText}`)
    }

    const data = await res.json()
    const pages = Array.isArray(data?.data) ? data.data : []

    console.log('📄 Páginas encontradas:', pages.length)
    if (pages.length === 0) {
      throw new Error('No tienes páginas de Facebook. Crea una página en facebook.com/pages/create')
    }

    const page = pages.find((p: any) => p?.instagram_business_account?.id && p?.access_token)

    if (!page) {
      const pageNames = pages.map((p: any) => p?.name || 'Sin nombre').join(', ')
      throw new Error(`Ninguna de tus ${pages.length} página(s) de Facebook [${pageNames}] tiene una Cuenta de Instagram Business vinculada. Ve a la configuración de tu página en Facebook para vincular tu cuenta de Instagram Business.`)
    }

    console.log('✅ Página con Instagram encontrada:', {
      page_name: page.name,
      page_id: page.id,
      instagram_username: page.instagram_business_account.username
    })

    return {
      pageId: page.id as string,
      pageAccessToken: page.access_token as string,
      instagramBusinessAccountId: page.instagram_business_account.id as string,
      instagramUsername: page.instagram_business_account.username as string | undefined,
    }
  }

  ,

  /**
   * Get Instagram user profile from IGSID (Instagram Scoped ID)
   * This is used to get username, name, profile pic, etc. from webhook sender IDs
   *
   * @param igsid - Instagram Scoped User ID from webhook
   * @param pageAccessToken - Optional. If not provided, will get it automatically
   * @returns User profile data including username
   */
  async getUserProfileFromIGSID(igsid: string, pageAccessToken?: string) {
    try {
      // If no page access token provided, get it automatically
      let token = pageAccessToken
      if (!token) {
        const pageData = await this.getInstagramPageAccessToken()
        token = pageData.pageAccessToken
      }

      // Call User Profile API
      // https://developers.facebook.com/docs/messenger-platform/instagram/features/user-profile
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${igsid}?fields=name,username,profile_pic,follower_count,is_verified_user,is_user_follow_business,is_business_follow_user&access_token=${encodeURIComponent(token)}`
      )

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        console.error('❌ Error getting user profile:', errorData)
        throw new Error(`No se pudo obtener perfil de usuario: ${errorData?.error?.message || res.statusText}`)
      }

      const profile = await res.json()

      return {
        igsid: profile.id,
        name: profile.name,
        username: profile.username,
        profilePic: profile.profile_pic,
        followerCount: profile.follower_count,
        isVerified: profile.is_verified_user,
        isUserFollowBusiness: profile.is_user_follow_business,
        isBusinessFollowUser: profile.is_business_follow_user,
      }
    } catch (error) {
      console.error('❌ Error in getUserProfileFromIGSID:', error)
      throw error
    }
  }
}
