import { supabase } from '../../lib/supabase'
import { googleOAuthDirect } from './oauth-direct'

/**
 * Google Calendar Service
 * Usa OAuth directo con Google (sin Supabase Auth) para evitar limitaciones con scopes sensibles
 */

export const googleCalendarService = {
  /**
   * Inicia el flujo OAuth directo con Google para Calendar
   * IMPORTANTE: NO usa Supabase Auth porque Google rechaza scopes sensibles como Calendar
   * cuando se solicitan a través de terceros
   */
  async connectCalendar() {
    try {
      console.log('[GoogleCalendar] Starting direct OAuth flow (without Supabase Auth)')

      // Iniciar OAuth directo con Google
      await googleOAuthDirect.initiateOAuth()

      // La función anterior redirige a Google, por lo que este código no se ejecutará
      // hasta que el usuario vuelva del callback
    } catch (error) {
      console.error('[GoogleCalendar] Error connecting calendar:', error)
      throw error
    }
  },

  /**
   * Get the current Google access token from database
   * Refreshes the token automatically if está expirado
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
      let accessToken = integration.config?.provider_token
      const refreshToken = integration.config?.provider_refresh_token
      const tokenExpiresAt = integration.config?.token_expires_at

      // Si no hay token, pedir reconexión
      if (!accessToken) {
        throw new Error('No hay token de acceso de Google. Por favor, reconecta Google Calendar desde la página de Integraciones.')
      }

      // Verificar si el token está expirado (con 5 minutos de margen)
      const expiresAt = tokenExpiresAt ? new Date(tokenExpiresAt) : null
      const now = new Date()
      const isExpired = expiresAt ? (expiresAt.getTime() - now.getTime()) < (5 * 60 * 1000) : false

      if (isExpired && refreshToken) {
        console.log('[GoogleCalendar] Access token expired, refreshing...')

        try {
          // Refrescar el token usando OAuth directo
          const newTokens = await googleOAuthDirect.refreshAccessToken(refreshToken)

          // Actualizar tokens en la base de datos
          const updatedConfig = {
            ...integration.config,
            provider_token: newTokens.accessToken,
            token_expires_at: new Date(Date.now() + (newTokens.expiresIn * 1000)).toISOString(),
            last_token_refresh: new Date().toISOString()
          }

          await supabase
            .from('integrations')
            .update({ config: updatedConfig })
            .eq('id', integration.id)

          console.log('[GoogleCalendar] Token refreshed successfully')

          accessToken = newTokens.accessToken
        } catch (refreshError) {
          console.error('[GoogleCalendar] Error refreshing token:', refreshError)
          throw new Error('El token de Google Calendar expiró y no se pudo refrescar. Por favor, reconecta desde la página de Integraciones.')
        }
      }

      return {
        accessToken,
        refreshToken
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
      console.log('[GoogleCalendar] Disconnecting...')

      // Obtener el token de la integración para revocarlo
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        try {
          const { data: integration } = await supabase
            .from('integrations')
            .select('config')
            .eq('type', 'google-calendar')
            .eq('user_id', session.user.id)
            .single()

          const token = integration?.config?.provider_token
          if (token) {
            // Revocar el token usando el servicio OAuth directo
            await googleOAuthDirect.revokeToken(token)
            console.log('[GoogleCalendar] Token revoked')
          }
        } catch (error) {
          console.log('[GoogleCalendar] Could not revoke token (non-critical):', error)
          // No es crítico si falla la revocación
        }
      }

      return true
    } catch (error) {
      console.log('[GoogleCalendar] Disconnect error (non-critical):', error)
      // Siempre retornar true - la desconexión en DB es lo importante
      return true
    }
  }
}
