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
      console.log('[GoogleCalendar] Starting connectCalendar flow')

      // Obtener la sesión actual para verificar si ya está logueado con Google
      const { data: { session } } = await supabase.auth.getSession()
      console.log('[GoogleCalendar] Current session:', {
        hasSession: !!session,
        provider: session?.user?.app_metadata?.provider,
        hasProviderToken: !!session?.provider_token
      })

      // IMPORTANTE: Para solicitar scopes adicionales a una sesión existente de Google,
      // debemos usar include_granted_scopes: 'true' y prompt: 'consent'.
      // Esto permite que Google agregue los nuevos scopes sin descartar los anteriores.
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: CALENDAR_SCOPES.join(' '),
          redirectTo: `${window.location.origin}/auth/callback?provider=google&integration=google-calendar&redirect_to=/integrations`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent', // Forzar consentimiento para obtener refresh_token
            include_granted_scopes: 'true' // IMPORTANTE: mantener scopes anteriores y agregar los nuevos
          }
        }
      })

      if (error) {
        console.error('[GoogleCalendar] Error en connectCalendar:', error)
        throw error
      }

      console.log('[GoogleCalendar] OAuth initiated:', {
        hasUrl: !!data.url,
        provider: data.provider
      })

      // Si data.url existe, el navegador será redirigido automáticamente
      if (!data.url) {
        console.warn('[GoogleCalendar] No redirect URL returned from signInWithOAuth')
      }

      return data
    } catch (error) {
      console.error('[GoogleCalendar] Error connecting calendar:', error)
      throw error
    }
  },

  /**
   * Get the current Google access token from database (config field in integrations table)
   * Refreshes the token if needed using the refresh token
   * Los tokens NO se persisten en la sesión de Supabase, debemos guardarlos en DB
   */
  async getAccessToken() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error) throw error
      if (!session) throw new Error('No active session')

      // Obtener la integración de Google Calendar de la base de datos
      const { data: integration, error: integrationError } = await supabase
        .from('integrations')
        .select('*')
        .eq('type', 'google-calendar')
        .eq('user_id', session.user.id)
        .eq('status', 'connected')
        .limit(1)
        .single()

      if (integrationError || !integration) {
        throw new Error('Google Calendar no está conectado. Por favor, reconecta desde la página de Integraciones.')
      }

      // Obtener tokens del config
      let providerToken = integration.config?.provider_token
      const providerRefreshToken = integration.config?.provider_refresh_token

      // Si no hay token, pedir reconexión
      if (!providerToken) {
        throw new Error('No hay token de acceso de Google. Por favor, reconecta Google Calendar desde la página de Integraciones.')
      }

      // NOTA: Para implementar refresh automático de tokens, se necesitaría una Edge Function
      // en Supabase que maneje el client_secret de forma segura. Por ahora, si el token expira,
      // el usuario deberá reconectar (los tokens de Google duran 1 hora típicamente).
      // El refresh_token se guarda para futuras implementaciones.

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
        const errorData = await response.json().catch(() => ({}))
        // Si el token expiró (401), sugerir reconexión
        if (response.status === 401) {
          throw new Error('El token de Google Calendar expiró. Por favor, reconecta desde la página de Integraciones.')
        }
        throw new Error(`Failed to fetch calendars: ${errorData.error?.message || 'Unknown error'}`)
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

        // Si el token expiró o sin permisos, sugerir reconexión
        if (response.status === 401) {
          throw new Error('El token de Google Calendar expiró. Por favor, reconecta desde la página de Integraciones.')
        }

        if (response.status === 403) {
          throw new Error('No tienes permisos para acceder a Google Calendar. Por favor, reconecta desde la página de Integraciones.')
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
   * Verifica que exista la integración en DB con tokens guardados en config
   */
  async isConnected() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return false

      // Verificar el estado en la base de datos y que tenga tokens guardados
      const { data: integration } = await supabase
        .from('integrations')
        .select('status, config')
        .eq('type', 'google-calendar')
        .eq('user_id', session.user.id)
        .eq('status', 'connected')
        .limit(1)
        .single()

      // Está conectado si tiene la integración marcada como connected Y tiene tokens en config
      return !!integration && !!(integration.config?.provider_token || integration.config?.provider_refresh_token)
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
