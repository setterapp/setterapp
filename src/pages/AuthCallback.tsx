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
        // Supabase procesa automáticamente el código de la URL
        // Esperamos a que se complete el intercambio del código
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Error en callback:', sessionError)
          setError(sessionError.message)
          setTimeout(() => navigate('/login'), 3000)
          return
        }

        if (session) {
          // Obtener redirectTo una sola vez
          const redirectTo = new URLSearchParams(location.search).get('redirect_to') || '/analytics'

          console.log('✅ Sesión obtenida en callback:', {
            userId: session.user.id,
            hasProviderToken: !!session.provider_token,
            redirectTo
          })

          // Verificar si venimos de integraciones
          const isFromIntegrations = redirectTo.includes('/integrations') || redirectTo === '/integrations'
          const provider = new URLSearchParams(location.search).get('provider') || 'google'
          const integrationParam = new URLSearchParams(location.search).get('integration') // 'whatsapp' o 'instagram'

          console.log('📋 Información del callback:', {
            provider,
            integrationParam,
            isFromIntegrations,
            hasProviderToken: !!session.provider_token,
            userId: session.user.id
          })

          // Si hay un provider_token y venimos de integraciones, actualizar la integración correspondiente
          if (session.provider_token && isFromIntegrations) {
            try {
              let integrationType = 'instagram'

              if (provider === 'facebook') {
                // Si viene el parámetro integration, usarlo; si no, asumir instagram por defecto
                if (integrationParam === 'whatsapp') {
                  integrationType = 'whatsapp'
                  console.log('🔍 Buscando integración de WhatsApp para usuario:', session.user.id)
                } else {
                  integrationType = 'instagram'
                  console.log('🔍 Buscando integración de Instagram para usuario:', session.user.id)
                }
              }

              // Buscar la integración correspondiente
              const { data: integrations, error: intError } = await supabase
                .from('integrations')
                .select('*')
                .eq('type', integrationType)
                .eq('user_id', session.user.id)
                .limit(1)

              console.log('Resultado de búsqueda:', { integrations, intError })

              if (intError) {
                console.error('❌ Error al buscar integración:', intError)
              } else if (integrations && integrations.length > 0) {
                const integration = integrations[0]
                console.log('📝 Integración encontrada:', integration)

                // Actualizar a "connected" cuando viene del flujo de OAuth
                const { data: updated, error: updateError } = await supabase
                  .from('integrations')
                  .update({
                    status: 'connected',
                    connected_at: new Date().toISOString()
                  })
                  .eq('id', integration.id)
                  .eq('user_id', session.user.id)
                  .select()
                  .single()

                if (updateError) {
                  console.error('❌ Error al actualizar integración:', updateError)
                } else {
                    const integrationName = integrationType === 'instagram'
                      ? 'Instagram'
                      : 'WhatsApp'
                    console.log(`✅ ${integrationName} actualizado a "connected":`, updated)
                }
                  } else {
                    const integrationName = integrationType === 'instagram'
                      ? 'Instagram'
                      : 'WhatsApp'
                    console.warn(`⚠️ No se encontró integración de ${integrationName}`)
                  }
            } catch (err) {
              console.error('❌ Error en el proceso de actualización:', err)
            }
          } else {
            console.log('ℹ️ No es un callback de OAuth de integraciones')
          }

          // Esperar un momento para que se complete la actualización antes de redirigir
          await new Promise(resolve => setTimeout(resolve, 500))

          // Redirigir según el parámetro redirect_to o por defecto a /analytics
          console.log('🔄 Redirigiendo a:', redirectTo)
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
        console.error('Error en callback:', err)
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
