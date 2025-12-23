import { supabase } from '../../lib/supabase'

/**
 * Google Calendar OAuth Service
 * Handles authentication and calendar operations
 */

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
]

export const googleCalendarService = {
  /**
   * Initiate Google OAuth flow for Calendar access
   */
  async connectCalendar() {
    try {
      // Siempre forzar consentimiento para asegurar que se soliciten los scopes de Calendar
      // Esto es crítico: si el usuario ya tiene una sesión de Google sin scopes de Calendar,
      // necesitamos forzar un nuevo consentimiento
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: CALENDAR_SCOPES.join(' '),
          redirectTo: `${window.location.origin}/auth/google-calendar/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent', // Forzar consentimiento para obtener nuevos scopes
            include_granted_scopes: 'false' // No incluir scopes anteriores
          }
        }
      })

      if (error) {
        console.error('Error en connectCalendar:', error)
        throw error
      }

      // Si data.url existe, el navegador será redirigido automáticamente
      // Si no hay URL, puede que ya esté autenticado pero sin los scopes correctos
      if (!data.url) {
      }

      return data
    } catch (error) {
      console.error('Error connecting calendar:', error)
      throw error
    }
  },

  /**
   * Get the current Google access token from Supabase session
   * Refreshes the token if needed - ahora más robusto y silencioso
   * Si no hay tokens, verifica si la integración está conectada en DB y ofrece reconectar
   */
  async getAccessToken() {
    try {
      let { data: { session }, error } = await supabase.auth.getSession()

      if (error) throw error
      if (!session) throw new Error('No active session')

      // Get the provider token (Google access token)
      let providerToken = session.provider_token
      const providerRefreshToken = session.provider_refresh_token

      // Si no hay token, intentar refrescar la sesión automáticamente
      if (!providerToken) {
        if (providerRefreshToken) {
          try {
            // Forzar refresco de la sesión
            const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()

            if (refreshError) {
              console.error('Error refreshing session:', refreshError)
              // No lanzar error inmediatamente - intentar una vez más
              // A veces el refresh necesita un pequeño delay
              await new Promise(resolve => setTimeout(resolve, 500))
              const { data: { session: retrySession }, error: retryError } = await supabase.auth.refreshSession()

              if (retryError || !retrySession?.provider_token) {
                // Verificar si la integración está marcada como conectada en DB
                const { data: integrations } = await supabase
                  .from('integrations')
                  .select('*')
                  .eq('type', 'google-calendar')
                  .eq('status', 'connected')
                  .eq('user_id', session.user.id)
                  .limit(1)

                if (integrations && integrations.length > 0) {
                  throw new Error('Google Calendar está conectado pero los tokens expiraron. Por favor, reconecta desde la página de Integraciones.')
                } else {
                  throw new Error('No se pudo refrescar el token. Por favor, reconecta Google Calendar.')
                }
              }

              session = retrySession
              providerToken = retrySession.provider_token
            } else if (refreshedSession?.provider_token) {
              session = refreshedSession
              providerToken = refreshedSession.provider_token
            } else {
              throw new Error('No hay token de acceso de Google después del refresco. Por favor, reconecta Google Calendar desde la página de Integraciones.')
            }
          } catch (refreshErr: any) {
            console.error('Error al refrescar token:', refreshErr)
            throw new Error(refreshErr.message || 'No se pudo obtener el token de Google. Por favor, reconecta Google Calendar.')
          }
        } else {
          // No hay ni token ni refresh_token
          // Verificar si la integración está marcada como conectada en DB
          const { data: integrations } = await supabase
            .from('integrations')
            .select('*')
            .eq('type', 'google-calendar')
            .eq('status', 'connected')
            .eq('user_id', session.user.id)
            .limit(1)

          if (integrations && integrations.length > 0) {
            // Google Calendar está conectado pero no hay tokens - iniciar OAuth automáticamente
            const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: {
                scopes: CALENDAR_SCOPES.join(' '),
                redirectTo: `${window.location.origin}/auth/callback?redirect_to=${encodeURIComponent(window.location.pathname)}&provider=google`,
                queryParams: {
                  access_type: 'offline',
                  prompt: 'consent',
                }
              }
            })

            if (oauthError) {
              throw new Error('Google Calendar está conectado pero los tokens no están disponibles. Por favor, reconecta desde la página de Integraciones.')
            }

            if (data.url) {
              // Redirigir automáticamente a Google OAuth
              window.location.href = data.url
              // Retornar un error temporal mientras se redirige
              throw new Error('Redirigiendo a Google para restaurar la conexión...')
            } else {
              throw new Error('Google Calendar está conectado pero los tokens no están disponibles. Por favor, reconecta desde la página de Integraciones.')
            }
          } else {
            throw new Error('No hay token de acceso de Google. Por favor, reconecta Google Calendar desde la página de Integraciones.')
          }
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
   * List user's calendars
   */
  async listCalendars() {
    try {
      const { accessToken } = await this.getAccessToken()

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch calendars')
      }

      const data = await response.json()
      return data.items || []
    } catch (error) {
      throw error
    }
  },

  /**
   * Create a calendar event
   */
  async createEvent({
    calendarId = 'primary',
    summary,
    description,
    start,
    end,
    attendees = []
  }: {
    calendarId?: string
    summary: string
    description?: string
    start: string
    end: string
    attendees?: string[]
  }) {
    try {
      const { accessToken } = await this.getAccessToken()

      const event = {
        summary,
        description,
        start: {
          dateTime: start,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: end,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        attendees: attendees.map(email => ({ email })),
        reminders: {
          useDefault: true
        }
      }

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(event)
        }
      )

      if (!response.ok) {
        throw new Error('Failed to create event')
      }

      const data = await response.json()
      return data
    } catch (error) {
      throw error
    }
  },

  /**
   * List events from a calendar
   */
  async listEvents({
    calendarId = 'primary',
    timeMin,
    timeMax,
    maxResults = 10
  }: {
    calendarId?: string
    timeMin?: string
    timeMax?: string
    maxResults?: number
  }) {
    try {
      const { accessToken } = await this.getAccessToken()

      const params = new URLSearchParams({
        maxResults: maxResults.toString(),
        singleEvents: 'true',
        orderBy: 'startTime'
      })

      if (timeMin) params.append('timeMin', timeMin)
      if (timeMax) params.append('timeMax', timeMax)

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Error fetching events:', response.status, errorData)

        if (response.status === 401 || response.status === 403) {
          // Token expirado o sin permisos - intentar refrescar automáticamente
          try {
            // Intentar refrescar hasta 2 veces con delay
            let refreshedSession = null

            for (let attempt = 0; attempt < 2; attempt++) {
              if (attempt > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000))
              }

              const { data: { session }, error } = await supabase.auth.refreshSession()

              if (!error && session?.provider_token) {
                refreshedSession = session
                break
              }
            }

            if (!refreshedSession?.provider_token) {
              console.error('No se pudo refrescar el token después de varios intentos')
              throw new Error('El token de Google Calendar ha expirado. Por favor, reconecta Google Calendar desde la página de Integraciones.')
            }

            // Reintentar con el nuevo token
            const retryResponse = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`,
              {
                headers: {
                  Authorization: `Bearer ${refreshedSession.provider_token}`,
                  'Content-Type': 'application/json'
                }
              }
            )

            if (!retryResponse.ok) {
              const retryErrorData = await retryResponse.json().catch(() => ({}))
              console.error('Error después de refrescar:', retryResponse.status, retryErrorData)

              // Si sigue fallando después de refrescar, puede ser un problema de permisos
              if (retryResponse.status === 403) {
                throw new Error('No tienes permisos para acceder a Google Calendar. Por favor, reconecta Google Calendar desde la página de Integraciones.')
              }

              throw new Error(`Error al obtener eventos: ${retryErrorData.error?.message || 'Error desconocido'}`)
            }

            const retryData = await retryResponse.json()
            return retryData.items || []
          } catch (refreshErr: any) {
            console.error('Error al refrescar token:', refreshErr)
            throw new Error(refreshErr.message || 'Error al refrescar el token de Google Calendar')
          }
        }

        throw new Error(`Error al obtener eventos: ${errorData.error?.message || 'Error desconocido'}`)
      }

      const data = await response.json()
      return data.items || []
    } catch (error) {
      throw error
    }
  },

  /**
   * Check if user has Google Calendar connected
   * Ahora verifica también el refresh_token para considerar conectado
   */
  async isConnected() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      // Considerar conectado si hay token activo O refresh_token (puede refrescar)
      return !!(session?.provider_token || session?.provider_refresh_token)
    } catch (error) {
      return false
    }
  },

  /**
   * Disconnect Google Calendar
   */
  async disconnect() {
    try {
      // Intentar revocar el token si existe (pero no es crítico si falla)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.provider_token) {
          const token = session.provider_token

          // Revocar el token usando el endpoint correcto de Google
          // Google devuelve 200 incluso si el token ya está revocado o es inválido
          // Un 400 puede significar que el token ya está expirado/revocado, lo cual es OK
          try {
            const revokeResponse = await fetch(
              `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded'
                }
              }
            )

            // Google puede devolver 200 (éxito) o 400 (token inválido/expirado)
            // Ambos casos son aceptables para nosotros
            if (revokeResponse.status === 200 || revokeResponse.status === 400) {
            }
          } catch (revokeError) {
            // Ignorar errores de red - no es crítico
          }
        }
      } catch (error) {
        // Ignorar errores completamente - no es crítico para la desconexión
      }

      // La desconexión real se hace actualizando el estado en la base de datos
      // El token se limpiará cuando el usuario cierre sesión o expire
      return true
    } catch (error) {
      // Siempre retornar true - la desconexión en DB es lo importante
      return true
    }
  }
}
