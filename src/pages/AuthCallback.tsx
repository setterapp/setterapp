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
        // Supabase procesa automáticamente el código de la URL (detectSessionInUrl=true en esta ruta)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

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

          // Si hay un provider_token y venimos de integraciones, actualizar la integración correspondiente
          if (session.provider_token && isFromIntegrations) {
            try {
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
                // Google Calendar no necesita configuración adicional
                // Los tokens se manejan a través de Supabase Auth (provider_token y provider_refresh_token)
                config = {
                  connected_via: 'supabase_oauth',
                  scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events']
                }
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
                  alert(`No se pudo conectar Instagram: ${igError.message || 'Error desconocido'}.\n\nAsegúrate de:\n1. Tener una Página de Facebook\n2. Tener una Cuenta de Instagram Business vinculada a esa Página\n3. Haber otorgado todos los permisos solicitados`)
                }
              }

              // Nombre de integración
              const integrationName = integrationType === 'google-calendar'
                ? 'Google Calendar'
                : integrationType === 'whatsapp'
                ? 'WhatsApp'
                : 'Instagram'

              // Intentar upsert primero
              const { error: upsertError } = await supabase
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

              if (upsertError) {
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
              }
            } catch (err) {
              console.error('Error processing integration callback:', err)
            }
          } else {
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
              setError('No se pudo completar la autenticación')
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
