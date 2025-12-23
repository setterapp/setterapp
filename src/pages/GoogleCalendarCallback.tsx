import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function GoogleCalendarCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleGoogleCalendarCallback = async () => {
      try {
        // Supabase procesa automáticamente el código de la URL
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Error getting session:', sessionError)
          setError(sessionError.message)
          setTimeout(() => navigate('/integrations'), 3000)
          return
        }

        if (!session) {
          // Si no hay sesión, esperar un momento y verificar de nuevo
          setTimeout(async () => {
            const { data: { session: retrySession } } = await supabase.auth.getSession()
            if (retrySession) {
              await processGoogleCalendarIntegration(retrySession)
            } else {
              setError('No se pudo completar la autenticación con Google')
              setTimeout(() => navigate('/integrations'), 3000)
            }
          }, 1000)
          return
        }

        await processGoogleCalendarIntegration(session)
      } catch (err: any) {
        console.error('Error in callback:', err)
        setError(err.message || 'Error desconocido')
        setTimeout(() => navigate('/integrations'), 3000)
      }
    }

    const processGoogleCalendarIntegration = async (session: any) => {
      try {
        // Verificar que tengamos un provider_token de Google
        if (!session.provider_token) {
          throw new Error('No se recibió token de acceso de Google')
        }

        // Buscar la integración de Google Calendar
        const { data: integrations, error: findError } = await supabase
          .from('integrations')
          .select('*')
          .eq('type', 'google-calendar')
          .eq('user_id', session.user.id)
          .limit(1)

        if (findError) {
          console.error('Error finding integration:', findError)
          throw new Error('Error al buscar la integración de Google Calendar')
        }

        let integration = integrations && integrations.length > 0 ? integrations[0] : null

        // Si no existe la integración, crearla
        if (!integration) {
          const { data: newIntegration, error: createError } = await supabase
            .from('integrations')
            .insert({
              user_id: session.user.id,
              type: 'google-calendar',
              name: 'Google Calendar',
              status: 'connected',
              connected_at: new Date().toISOString(),
              config: {
                connected_via: 'supabase_oauth',
                scopes: [
                  'https://www.googleapis.com/auth/calendar',
                  'https://www.googleapis.com/auth/calendar.events'
                ]
              }
            })
            .select()
            .single()

          if (createError) {
            console.error('Error creating integration:', createError)
            throw new Error('Error al crear la integración de Google Calendar')
          }

          integration = newIntegration
        } else {
          // Si existe, actualizarla a "connected"
          const { error: updateError } = await supabase
            .from('integrations')
            .update({
              status: 'connected',
              connected_at: new Date().toISOString(),
              config: {
                ...(integration.config || {}),
                connected_via: 'supabase_oauth',
                scopes: [
                  'https://www.googleapis.com/auth/calendar',
                  'https://www.googleapis.com/auth/calendar.events'
                ]
              }
            })
            .eq('id', integration.id)
            .eq('user_id', session.user.id)

          if (updateError) {
            console.error('Error updating integration:', updateError)
            throw new Error('Error al actualizar la integración de Google Calendar')
          }
        }

        // Esperar un momento antes de redirigir para asegurar que se complete la actualización
        await new Promise(resolve => setTimeout(resolve, 500))

        // Redirigir a integraciones
        navigate('/integrations')
      } catch (err: any) {
        console.error('Error processing integration:', err)
        throw err
      }
    }

    handleGoogleCalendarCallback()
  }, [navigate])

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
          <h3 style={{ color: 'var(--color-danger)' }}>Error al conectar Google Calendar</h3>
          <p className="text-secondary">{error}</p>
          <p className="text-tertiary text-sm">Redirigiendo a integraciones...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
        <p>Conectando Google Calendar...</p>
      </div>
    </div>
  )
}

export default GoogleCalendarCallback
