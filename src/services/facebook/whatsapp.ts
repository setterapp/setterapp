import { supabase } from '../../lib/supabase'

/**
 * Facebook/WhatsApp Business OAuth Service
 * Handles authentication and WhatsApp Business operations using Facebook OAuth
 *
 * IMPORTANTE: WhatsApp Business API también usa la API de Facebook/Meta,
 * por lo que podemos usar el mismo OAuth que Instagram.
 */

// Scopes necesarios para WhatsApp Business
// Estos son los permisos mínimos requeridos que debes solicitar en Facebook Developers
const WHATSAPP_SCOPES = [
  'whatsapp_business_management', // ✅ REQUERIDO: Gestionar WhatsApp Business (cuentas, números, templates, webhooks)
  'whatsapp_business_messaging', // ✅ REQUERIDO: Enviar y recibir mensajes de WhatsApp
  'business_management',         // ✅ REQUERIDO: Acceder a Business Manager API
  // Nota: Los permisos de 'pages_*' pueden ser necesarios si quieres obtener información de páginas
  // pero WhatsApp Business puede funcionar sin ellos si ya tienes el phoneNumberId
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
        throw new Error('No se pudo obtener la URL de autorización de Facebook')
      }

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
   *
   * Este método intenta obtener la información desde la integración guardada primero,
   * y si no está disponible, la obtiene de la API de Facebook.
   */
  async getWhatsAppBusinessAccount(pageId?: string) {
    try {
      const { accessToken } = await this.getAccessToken()

      // Primero intentar obtener desde la integración guardada
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: integration } = await supabase
          .from('integrations')
          .select('config')
          .eq('type', 'whatsapp')
          .eq('user_id', user.id)
          .eq('status', 'connected')
          .single()

        if (integration?.config?.phoneNumberId && integration?.config?.whatsappBusinessAccountId) {
          return {
            pageId: integration.config.pageId,
            whatsappBusinessAccountId: integration.config.whatsappBusinessAccountId,
            phoneNumberId: integration.config.phoneNumberId
          }
        }
      }

      // Si no está en la integración, obtener desde la API

      // Intentar obtener WhatsApp Business Accounts directamente
      // Esto funciona con whatsapp_business_management permission
      try {
        const wabaResponse = await fetch(
          `https://graph.facebook.com/v18.0/me/businesses?fields=id,name,whatsapp_business_accounts{id,phone_numbers{id,display_phone_number,verified_name}}&access_token=${accessToken}`
        )

        if (wabaResponse.ok) {
          const wabaData = await wabaResponse.json()

          // Buscar la primera cuenta de WhatsApp Business con un número de teléfono
          if (wabaData.data && wabaData.data.length > 0) {
            for (const business of wabaData.data) {
              if (business.whatsapp_business_accounts?.data?.length > 0) {
                const waba = business.whatsapp_business_accounts.data[0]
                if (waba.phone_numbers?.data?.length > 0) {
                  const phoneNumber = waba.phone_numbers.data[0]
                  const result = {
                    pageId: null, // No necesitamos pageId si obtenemos directamente
                    whatsappBusinessAccountId: waba.id,
                    phoneNumberId: phoneNumber.id
                  }

                  // Guardar en la integración
                  if (user) {
                    const { data: integration } = await supabase
                      .from('integrations')
                      .select('id')
                      .eq('type', 'whatsapp')
                      .eq('user_id', user.id)
                      .single()

                    if (integration) {
                      await supabase
                        .from('integrations')
                        .update({ config: result })
                        .eq('id', integration.id)
                    }
                  }
                  return result
                }
              }
            }
          }
        }
      } catch (wabaError) {
      }

      // Método alternativo: obtener desde páginas (requiere permisos de Pages)
      // Si no se proporciona pageId, obtener la primera página del usuario
      if (!pageId) {
        const pagesResponse = await fetch(
          `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
        )

        if (!pagesResponse.ok) {
          const errorData = await pagesResponse.json().catch(() => ({}))
          // Si falla, puede ser que no tenga permisos de Pages
          throw new Error(`No se pudieron obtener las páginas de Facebook. Asegúrate de tener una página conectada a WhatsApp Business. Error: ${errorData.error?.message || 'Error desconocido'}`)
        }

        const pagesData = await pagesResponse.json()
        if (!pagesData.data || pagesData.data.length === 0) {
          throw new Error('No tienes páginas de Facebook conectadas. Necesitas una página para usar WhatsApp Business.')
        }

        pageId = pagesData.data[0].id
      }

      // Obtener el WhatsApp Business Account ID de la página
      const whatsappResponse = await fetch(
        `https://graph.facebook.com/v18.0/${pageId}?fields=whatsapp_business_account{id,phone_number_id}&access_token=${accessToken}`
      )

      if (!whatsappResponse.ok) {
        const errorData = await whatsappResponse.json().catch(() => ({}))
        throw new Error(`No se pudo obtener la cuenta de WhatsApp Business: ${errorData.error?.message || 'Error desconocido'}`)
      }

      const whatsappData = await whatsappResponse.json()

      if (!whatsappData.whatsapp_business_account) {
        throw new Error('Esta página de Facebook no tiene una cuenta de WhatsApp Business conectada. Por favor, conecta tu número de WhatsApp Business a esta página en Facebook Business Manager.')
      }

      const result = {
        pageId,
        whatsappBusinessAccountId: whatsappData.whatsapp_business_account.id,
        phoneNumberId: whatsappData.whatsapp_business_account.phone_number_id
      }

      // Guardar en la integración para uso futuro
      if (user) {
        const { data: integration } = await supabase
          .from('integrations')
          .select('id')
          .eq('type', 'whatsapp')
          .eq('user_id', user.id)
          .single()

        if (integration) {
          await supabase
            .from('integrations')
            .update({ config: result })
            .eq('id', integration.id)
        }
      }

      return result
    } catch (error) {
      throw error
    }
  },

  /**
   * Send a message via WhatsApp Business API
   * Si no se proporciona phoneNumberId, lo obtiene automáticamente
   */
  async sendMessage({
    phoneNumberId,
    to,
    message
  }: {
    phoneNumberId?: string
    to: string
    message: string
  }) {
    try {
      const { accessToken } = await this.getAccessToken()

      // Si no se proporciona phoneNumberId, obtenerlo automáticamente
      let finalPhoneNumberId = phoneNumberId
      if (!finalPhoneNumberId) {
        const whatsappInfo = await this.getWhatsAppBusinessAccount()
        finalPhoneNumberId = whatsappInfo.phoneNumberId
        if (!finalPhoneNumberId) {
          throw new Error('No se pudo obtener el Phone Number ID de WhatsApp Business. Por favor, verifica tu configuración.')
        }
      }

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${finalPhoneNumberId}/messages`,
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
      // Sin logs en producción por seguridad
      return true
    }
  }
}
