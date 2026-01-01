import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function AuthCallback() {
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('[AuthCallback] Starting handleAuthCallback')

        // IMPORTANTE: Para capturar el provider_token correctamente, necesitamos usar
        // onAuthStateChange y escuchar el evento SIGNED_IN, no getSession()
        // El provider_token solo está disponible en el evento SIGNED_IN inicial

        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const searchParams = new URLSearchParams(window.location.search)

        let session = null
        let sessionError = null

        // Si hay parámetros de OAuth en la URL, configurar listener para SIGNED_IN
        if (hashParams.has('access_token') || searchParams.has('code')) {
          console.log('[AuthCallback] OAuth params detected, waiting for SIGNED_IN event')

          // Crear una promesa que se resuelve cuando recibimos SIGNED_IN
          const sessionPromise = new Promise<any>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Timeout waiting for SIGNED_IN event'))
            }, 10000) // 10 segundos timeout

            const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, authSession) => {
              console.log('[AuthCallback] Auth event:', event, {
                hasSession: !!authSession,
                hasProviderToken: !!authSession?.provider_token,
                hasProviderRefreshToken: !!authSession?.provider_refresh_token
              })

              if (event === 'SIGNED_IN' && authSession) {
                clearTimeout(timeout)
                subscription.unsubscribe()
                resolve(authSession)
              }
            })
          })

          try {
            session = await sessionPromise
            console.log('[AuthCallback] Session obtained from SIGNED_IN event:', {
              hasProviderToken: !!session?.provider_token,
              providerTokenLength: session?.provider_token?.length || 0
            })
          } catch (err) {
            console.error('[AuthCallback] Error waiting for SIGNED_IN:', err)
            // Fallback a getSession si falla el listener
            const sessionResult = await supabase.auth.getSession()
            session = sessionResult.data.session
            sessionError = sessionResult.error
          }
        } else {
          // No hay params de OAuth, usar getSession normal
          const sessionResult = await supabase.auth.getSession()
          session = sessionResult.data.session
          sessionError = sessionResult.error
        }

        if (sessionError) {
          setError(sessionError.message)
          setTimeout(() => navigate('/login'), 3000)
          return
        }

        if (session) {
          // Obtener redirectTo una sola vez
          const redirectTo = new URLSearchParams(location.search).get('redirect_to') || '/analytics'

          // Verificar si venimos de integraciones
          const isFromIntegrations = redirectTo.includes('/integrations') || redirectTo === '/integrations'
          const provider = new URLSearchParams(location.search).get('provider') || 'google'
          const integrationParam = new URLSearchParams(location.search).get('integration') // 'whatsapp' | 'instagram' | 'google-calendar'

          // Si venimos de integraciones, intentar actualizar la integración correspondiente
          if (isFromIntegrations) {
            try {
              console.log('[AuthCallback] Processing integration callback', {
                provider,
                integrationParam,
                hasProviderToken: !!session.provider_token,
                hasProviderRefreshToken: !!session.provider_refresh_token,
                providerTokenLength: session.provider_token?.length || 0
              })

              let integrationType: 'instagram' | 'whatsapp' | 'google-calendar' = 'instagram'

              // Primero revisar si hay integrationParam explícito
              if (integrationParam === 'google-calendar') {
                integrationType = 'google-calendar'
              } else if (provider === 'google') {
                integrationType = 'google-calendar'
              } else if (provider === 'facebook') {
                // Si viene el parámetro integration, usarlo; si no, asumir instagram por defecto
                if (integrationParam === 'whatsapp') {
                  integrationType = 'whatsapp'
                } else {
                  integrationType = 'instagram'
                }
              }

              // Configuración según el tipo de integración
              let config: Record<string, any> = {}

              if (integrationType === 'google-calendar') {
                // IMPORTANTE: Guardar los tokens porque Supabase NO los persiste automáticamente
                // Los provider_token y provider_refresh_token solo están disponibles en la sesión inicial
                // Después de un refresh, desaparecen. Por eso los guardamos en config.

                // Si no hay provider_token, necesitamos esperar más o mostrar error
                if (!session.provider_token) {
                  console.error('[AuthCallback] No provider_token available for Google Calendar!')
                  console.log('[AuthCallback] Session details:', {
                    hasSession: !!session,
                    userId: session.user?.id,
                    provider: session.user?.app_metadata?.provider,
                    providers: session.user?.app_metadata?.providers
                  })

                  // Intentar esperar más tiempo y verificar de nuevo
                  await new Promise(resolve => setTimeout(resolve, 2000))
                  const { data: { session: retrySession } } = await supabase.auth.getSession()

                  if (retrySession?.provider_token) {
                    console.log('[AuthCallback] provider_token found after retry!')
                    session = retrySession
                  } else {
                    console.error('[AuthCallback] Still no provider_token after retry')
                    alert('Error: Could not obtain Google access token. Please try disconnecting and reconnecting Google Calendar.')
                    navigate('/integrations')
                    return
                  }
                }

                config = {
                  connected_via: 'supabase_oauth',
                  scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events'],
                  provider_token: session.provider_token,
                  provider_refresh_token: session.provider_refresh_token,
                  token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // Google tokens típicamente duran 1 hora
                  last_token_refresh: new Date().toISOString()
                }

                console.log('[AuthCallback] Saving Google Calendar config:', {
                  hasProviderToken: !!config.provider_token,
                  hasRefreshToken: !!config.provider_refresh_token,
                  tokenExpiresAt: config.token_expires_at
                })
              } else if (integrationType === 'whatsapp') {
                try {
                  const { whatsappService } = await import('../services/facebook/whatsapp')
                  const whatsappInfo = await whatsappService.getWhatsAppBusinessAccount()

                  config = {
                    pageId: whatsappInfo.pageId,
                    whatsappBusinessAccountId: whatsappInfo.whatsappBusinessAccountId,
                    phoneNumberId: whatsappInfo.phoneNumberId,
                  }

                } catch (whatsappError: any) {
                  // Continuar con la conexión aunque falle la obtención de info
                  // El usuario puede configurarlo después
                }
              } else if (integrationType === 'instagram') {
                try {
                  const { instagramService } = await import('../services/facebook/instagram')
                  const igInfo = await instagramService.getInstagramPageAccessToken()
                  config = {
                    page_id: igInfo.pageId,
                    page_access_token: igInfo.pageAccessToken,
                    instagram_business_account_id: igInfo.instagramBusinessAccountId,
                    instagram_username: igInfo.instagramUsername,
                  }
                } catch (igError: any) {
                  // Si no podemos obtener page token, igual dejamos la integración conectada.
                  // El usuario puede reconectar con permisos correctos luego.
                  alert(`Could not connect Instagram: ${igError.message || 'Unknown error'}.\n\nMake sure you:\n1. Have a Facebook Page\n2. Have an Instagram Business Account linked to that Page\n3. Have granted all requested permissions`)
                }
              }

              // Nombre de integración
              const integrationName = integrationType === 'google-calendar'
                ? 'Google Calendar'
                : integrationType === 'whatsapp'
                ? 'WhatsApp'
                : 'Instagram'

              // Intentar upsert primero
              console.log('[AuthCallback] Attempting to upsert integration:', {
                type: integrationType,
                name: integrationName,
                hasConfig: Object.keys(config).length > 0,
                configKeys: Object.keys(config)
              })

              const { data: upsertData, error: upsertError } = await supabase
                .from('integrations')
                .upsert({
                  user_id: session.user.id,
                  type: integrationType,
                  name: integrationName,
                  status: 'connected',
                  connected_at: new Date().toISOString(),
                  config: Object.keys(config).length > 0 ? config : {}
                }, {
                  onConflict: 'user_id,type',
                  ignoreDuplicates: false
                })
                .select()

              if (upsertError) {
                console.error('[AuthCallback] Upsert error:', upsertError)
                // Si falla el upsert, verificar si existe y actualizar, o crear nueva
                const { data: existing } = await supabase
                  .from('integrations')
                  .select('*')
                  .eq('type', integrationType)
                  .eq('user_id', session.user.id)
                  .limit(1)
                  .single()

                if (existing) {
                  // Actualizar existente
                  const { error: updateError } = await supabase
                    .from('integrations')
                    .update({
                      status: 'connected',
                      connected_at: new Date().toISOString(),
                      config: Object.keys(config).length > 0 ? { ...(existing.config || {}), ...config } : existing.config
                    })
                    .eq('id', existing.id)
                    .eq('user_id', session.user.id)

                  if (updateError) {
                    console.error('Error updating integration:', updateError)
                  }
                } else {
                  // Crear nueva integración
                  const { error: insertError } = await supabase
                    .from('integrations')
                    .insert({
                      user_id: session.user.id,
                      type: integrationType,
                      name: integrationName,
                      status: 'connected',
                      connected_at: new Date().toISOString(),
                      config: Object.keys(config).length > 0 ? config : {}
                    })

                  if (insertError) {
                    console.error('Error inserting integration:', insertError)
                  }
                }
              } else {
                console.log('[AuthCallback] Upsert successful!', {
                  type: integrationType,
                  upsertData
                })
              }

              // Verificar que se guardó correctamente
              const { data: savedIntegration, error: verifyError } = await supabase
                .from('integrations')
                .select('*')
                .eq('type', integrationType)
                .eq('user_id', session.user.id)
                .single()

              if (verifyError) {
                console.error('[AuthCallback] Error verifying saved integration:', verifyError)
              } else {
                console.log('[AuthCallback] Integration saved successfully:', {
                  id: savedIntegration.id,
                  type: savedIntegration.type,
                  status: savedIntegration.status,
                  hasConfig: !!savedIntegration.config,
                  configKeys: savedIntegration.config ? Object.keys(savedIntegration.config) : [],
                  hasProviderToken: !!savedIntegration.config?.provider_token,
                  hasRefreshToken: !!savedIntegration.config?.provider_refresh_token
                })
              }
            } catch (err) {
              console.error('[AuthCallback] Error processing integration callback:', err)
            }
          } else {
            console.log('[AuthCallback] Not from integrations, skipping integration save')
          }

          // Esperar más tiempo para que se complete la actualización antes de redirigir
          await new Promise(resolve => setTimeout(resolve, 2500))

          // Redirigir según el parámetro redirect_to o por defecto a /analytics
          // Agregar parámetro para forzar refetch si vamos a integraciones
          const finalRedirectTo = redirectTo.includes('/integrations')
            ? `${redirectTo}${redirectTo.includes('?') ? '&' : '?'}refetch=true&t=${Date.now()}`
            : redirectTo
          navigate(finalRedirectTo)
        } else {
          // Si no hay sesión, esperar un momento y verificar de nuevo
          // (a veces el intercambio del código tarda un poco)
          setTimeout(async () => {
            const { data: { session: retrySession } } = await supabase.auth.getSession()
            if (retrySession) {
              const redirectToRetry = new URLSearchParams(location.search).get('redirect_to') || '/analytics'
              navigate(redirectToRetry)
            } else {
              setError('Could not complete authentication')
              setTimeout(() => navigate('/login'), 3000)
            }
          }, 1000)
        }
      } catch (err: any) {
        setError(err.message || 'Error desconocido')
        setTimeout(() => navigate('/login'), 3000)
      }
    }

    handleAuthCallback()
  }, [navigate, location])

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
          <h3 style={{ color: 'var(--color-danger)' }}>Error de autenticación</h3>
          <p className="text-secondary">{error}</p>
          <p className="text-tertiary text-sm">Redirigiendo...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
        <p>Completando autenticación...</p>
      </div>
    </div>
  )
}

export default AuthCallback
