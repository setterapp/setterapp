import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { googleOAuthDirect } from '../services/google/oauth-direct'

/**
 * Callback para OAuth directo de Google Calendar
 * Maneja el intercambio de código por tokens y los guarda en la base de datos
 */
function GoogleCalendarCallback() {
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('Procesando autenticación...')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('[GoogleCalendarCallback] Processing OAuth callback')

        // Obtener parámetros de la URL
        const params = new URLSearchParams(location.search)
        const code = params.get('code')
        const state = params.get('state')
        const errorParam = params.get('error')

        // Verificar si hubo un error en la autorización
        if (errorParam) {
          console.error('[GoogleCalendarCallback] OAuth error:', errorParam)
          setError(`Error de autorización: ${errorParam}`)
          setTimeout(() => navigate('/integrations'), 3000)
          return
        }

        // Verificar que tengamos el código
        if (!code || !state) {
          console.error('[GoogleCalendarCallback] Missing code or state')
          setError('Parámetros de callback inválidos')
          setTimeout(() => navigate('/integrations'), 3000)
          return
        }

        console.log('[GoogleCalendarCallback] Code received, exchanging for tokens')
        setStatus('Obteniendo tokens de acceso...')

        // Intercambiar código por tokens
        const tokens = await googleOAuthDirect.exchangeCodeForTokens(code, state)

        console.log('[GoogleCalendarCallback] Tokens obtained, saving to database')
        setStatus('Guardando configuración...')

        // Obtener usuario actual
        const { data: { session: userSession } } = await supabase.auth.getSession()
        if (!userSession?.user) {
          throw new Error('No hay sesión de usuario activa')
        }

        // Guardar tokens en la integración de Google Calendar
        const config = {
          provider_token: tokens.accessToken,
          provider_refresh_token: tokens.refreshToken,
          token_expires_at: new Date(Date.now() + (tokens.expiresIn * 1000)).toISOString(),
          last_token_refresh: new Date().toISOString(),
          scope: tokens.scope,
          auth_method: 'direct_oauth', // Para distinguir del método de Supabase Auth
          connected_via: 'google_oauth_direct'
        }

        console.log('[GoogleCalendarCallback] Saving integration config:', {
          hasAccessToken: !!config.provider_token,
          hasRefreshToken: !!config.provider_refresh_token,
          expiresAt: config.token_expires_at
        })

        // Upsert la integración
        const { data: upsertData, error: upsertError } = await supabase
          .from('integrations')
          .upsert({
            user_id: userSession.user.id,
            type: 'google-calendar',
            name: 'Google Calendar',
            status: 'connected',
            connected_at: new Date().toISOString(),
            config
          }, {
            onConflict: 'user_id,type',
            ignoreDuplicates: false
          })
          .select()

        if (upsertError) {
          console.error('[GoogleCalendarCallback] Error saving integration:', upsertError)

          // Intentar actualizar si ya existe
          const { data: existing } = await supabase
            .from('integrations')
            .select('*')
            .eq('type', 'google-calendar')
            .eq('user_id', userSession.user.id)
            .single()

          if (existing) {
            const { error: updateError } = await supabase
              .from('integrations')
              .update({
                status: 'connected',
                connected_at: new Date().toISOString(),
                config: { ...(existing.config || {}), ...config }
              })
              .eq('id', existing.id)

            if (updateError) {
              throw updateError
            }
          } else {
            throw upsertError
          }
        }

        console.log('[GoogleCalendarCallback] Integration saved successfully:', upsertData)

        // Verificar que se guardó correctamente
        const { data: savedIntegration } = await supabase
          .from('integrations')
          .select('*')
          .eq('type', 'google-calendar')
          .eq('user_id', userSession.user.id)
          .single()

        console.log('[GoogleCalendarCallback] Verification:', {
          id: savedIntegration?.id,
          status: savedIntegration?.status,
          hasProviderToken: !!savedIntegration?.config?.provider_token,
          hasRefreshToken: !!savedIntegration?.config?.provider_refresh_token
        })

        setStatus('¡Conexión exitosa! Redirigiendo...')

        // Esperar un momento y redirigir a integraciones
        await new Promise(resolve => setTimeout(resolve, 1500))
        navigate('/integrations?refetch=true&t=' + Date.now())

      } catch (err: any) {
        console.error('[GoogleCalendarCallback] Error processing callback:', err)
        setError(err.message || 'Error desconocido al procesar la autenticación')
        setTimeout(() => navigate('/integrations'), 3000)
      }
    }

    handleCallback()
  }, [navigate, location])

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
          <h3 style={{ color: 'var(--color-danger)' }}>Error de autenticación</h3>
          <p className="text-secondary">{error}</p>
          <p className="text-tertiary text-sm">Redirigiendo a Integraciones...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
        <p>{status}</p>
      </div>
    </div>
  )
}

export default GoogleCalendarCallback
