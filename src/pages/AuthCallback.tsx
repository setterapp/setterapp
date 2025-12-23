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
          const integrationParam = new URLSearchParams(location.search).get('integration') // 'whatsapp' | 'instagram'

          // Si hay un provider_token y venimos de integraciones, actualizar la integración correspondiente
          if (session.provider_token && isFromIntegrations) {
            try {
              let integrationType: 'instagram' | 'whatsapp' | 'google-calendar' = 'instagram'

              if (provider === 'google') {
                integrationType = 'google-calendar'
              } else if (provider === 'facebook') {
                // Si viene el parámetro integration, usarlo; si no, asumir instagram por defecto
                if (integrationParam === 'whatsapp') {
                  integrationType = 'whatsapp'
                } else {
                  integrationType = 'instagram'
                }
              }

              // Buscar la integración correspondiente
              const { data: integrations, error: intError } = await supabase
                .from('integrations')
                .select('*')
                .eq('type', integrationType)
                .eq('user_id', session.user.id)
                .limit(1)

              if (intError) {
                // Evitar logs en producción por seguridad
              }

              // Si no existe la integración, crearla
              let integration = integrations && integrations.length > 0 ? integrations[0] : null

              if (!integration) {
                // Crear integración si no existe
                const integrationName = integrationType === 'google-calendar'
                  ? 'Google Calendar'
                  : integrationType === 'whatsapp'
                  ? 'WhatsApp'
                  : 'Instagram'

                const { data: newIntegration, error: createError } = await supabase
                  .from('integrations')
                  .insert({
                    user_id: session.user.id,
                    type: integrationType,
                    name: integrationName,
                    status: 'disconnected',
                    config: {}
                  })
                  .select()
                  .single()

                if (createError) {
                  console.error('Error creating integration:', createError)
                } else {
                  integration = newIntegration
                }
              }

              if (integration) {

                // Si es WhatsApp, obtener información de la cuenta de WhatsApp Business
                let config: Record<string, any> = {}
                let canMarkConnected = true

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
                    console.error('❌ Error obteniendo Instagram Page Access Token:', igError.message || igError)
                    // Si no podemos obtener page token, igual dejamos la integración conectada.
                    // El usuario puede reconectar con permisos correctos luego.
                    alert(`No se pudo conectar Instagram: ${igError.message || 'Error desconocido'}.

Asegúrate de:
1. Tener una Página de Facebook
2. Tener una Cuenta de Instagram Business vinculada a esa Página
3. Haber otorgado todos los permisos solicitados`)
                  }
                }

                // Actualizar a "connected" cuando viene del flujo de OAuth
                const { error: updateError } = await supabase
                  .from('integrations')
                  .update({
                    status: canMarkConnected ? 'connected' : 'disconnected',
                    connected_at: canMarkConnected ? new Date().toISOString() : null,
                    // Merge para no pisar flags (p.ej. debug_webhooks)
                    config: Object.keys(config).length > 0 ? { ...(integration.config || {}), ...config } : undefined
                  })
                  .eq('id', integration.id)
                  .eq('user_id', session.user.id)
                  .select()
                  .single()

                if (updateError) {
                  // Evitar logs en producción por seguridad
                }
              }
            } catch (err) {
              // Evitar logs en producción por seguridad
            }
          } else {
          }

          // Esperar un momento para que se complete la actualización antes de redirigir
          await new Promise(resolve => setTimeout(resolve, 500))

          // Redirigir según el parámetro redirect_to o por defecto a /analytics
          navigate(redirectTo)
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
