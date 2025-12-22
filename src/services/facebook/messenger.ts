import { supabase } from '../../lib/supabase'

/**
 * Facebook Messenger OAuth / Graph helpers
 *
 * Nota: Messenger no expone "username" del usuario como tal. Lo que sí podemos obtener
 * (con Page access token) es el perfil básico: name / first_name / last_name / profile_pic.
 */
const MESSENGER_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'pages_messaging',
]

export const messengerService = {
  async connectMessenger() {
    const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !currentSession) {
      throw new Error('Debes iniciar sesión primero antes de conectar Messenger')
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        scopes: MESSENGER_SCOPES.join(','),
        redirectTo: `${window.location.origin}/auth/callback?redirect_to=/integrations&provider=facebook&integration=messenger`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        skipBrowserRedirect: false,
      },
    })

    if (error) throw error
    if (!data.url) throw new Error('No se pudo obtener la URL de autorización de Facebook')
    return data
  },

  async getAccessToken() {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    if (!session) throw new Error('No active session')

    let providerToken = session.provider_token
    const providerRefreshToken = session.provider_refresh_token

    if (!providerToken) {
      if (providerRefreshToken) {
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) {
          throw new Error('No se pudo refrescar el token. Por favor, reconecta Messenger.')
        }
        if (!refreshedSession?.provider_token) {
          throw new Error('No hay token de acceso de Facebook después del refresco. Por favor, reconecta Messenger.')
        }
        providerToken = refreshedSession.provider_token
      } else {
        throw new Error('No hay token de acceso de Facebook. Por favor, reconecta Messenger desde Integraciones.')
      }
    }

    return { accessToken: providerToken, refreshToken: providerRefreshToken }
  },

  /**
   * Get a Page access token (needed for Messenger webhook profile lookups and Send API).
   * Picks the first Page the user manages (best-effort).
   */
  async getMessengerPageAccessToken() {
    const { accessToken } = await this.getAccessToken()

    const res = await fetch(
      `https://graph.facebook.com/v24.0/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(accessToken)}`
    )

    if (!res.ok) {
      const errorData = await res.json().catch(() => null)
      throw new Error(`No se pudieron obtener páginas de Facebook: ${errorData?.error?.message || res.statusText}`)
    }

    const data = await res.json().catch(() => null)
    const pages = Array.isArray(data?.data) ? data.data : []
    if (pages.length === 0) {
      throw new Error('No tienes páginas de Facebook. Crea una página en facebook.com/pages/create')
    }

    const page = pages.find((p: any) => p?.id && p?.access_token) || pages[0]
    if (!page?.id || !page?.access_token) {
      throw new Error('No se encontró una página con access token')
    }

    const pageId = String(page.id)
    const pageName = String(page.name || 'Facebook Page')
    const pageAccessToken = String(page.access_token)

    // Best-effort: subscribe this page to app webhooks (requires pages_manage_metadata)
    try {
      await fetch(
        `https://graph.facebook.com/v24.0/${encodeURIComponent(pageId)}/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=${encodeURIComponent(pageAccessToken)}`,
        { method: 'POST' }
      )
    } catch {
      // ignore
    }

    return { pageId, pageName, pageAccessToken }
  },

  async disconnect() {
    return true
  },
}
