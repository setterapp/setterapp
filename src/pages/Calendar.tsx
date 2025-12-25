import { useState, useEffect } from 'react'
import { Clock, MapPin, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { googleCalendarService } from '../services/google/calendar'
import GoogleCalendarIcon from '../components/icons/GoogleCalendarIcon'

interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: {
    dateTime?: string
    date?: string
  }
  end: {
    dateTime?: string
    date?: string
  }
  location?: string
  attendees?: Array<{
    email: string
    displayName?: string
  }>
}

function Calendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    try {
      setLoading(true)
      setError(null)

      // Verificar si hay sesión activa
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        setError('No hay sesión activa. Por favor, inicia sesión.')
        setLoading(false)
        return
      }

      // Verificar si hay integración de Google Calendar conectada
      const { data: integrations, error: intError } = await supabase
        .from('integrations')
        .select('*')
        .eq('type', 'google-calendar')
        .eq('status', 'connected')
        .limit(1)

      if (intError) {
        console.error('Error checking integration:', intError)
        setError('Error al verificar la conexión de Google Calendar.')
        setLoading(false)
        return
      }

      if (!integrations || integrations.length === 0) {
        setError('Google Calendar no está conectado. Por favor, conéctalo desde la página de Integraciones.')
        setLoading(false)
        return
      }

      // Verificar si hay tokens disponibles antes de intentar obtener eventos
      const hasToken = !!(session.provider_token || session.provider_refresh_token)
      if (!hasToken) {
        // La integración está conectada pero no hay tokens (probablemente después de cerrar sesión)
        // Ofrecer reconectar automáticamente
        setError('Google Calendar está conectado pero los tokens no están disponibles. Por favor, reconecta desde la página de Integraciones.')
        setLoading(false)
        return
      }

      // Obtener eventos del calendario (el servicio manejará el token)
      const now = new Date()
      const calendarEvents = await googleCalendarService.listEvents({
        timeMin: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        timeMax: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString(),
        maxResults: 50,
      })

      setEvents(calendarEvents || [])
    } catch (err: any) {
      console.error('Error fetching events:', err)
      let errorMessage = err.message || 'Error al cargar eventos'

      // Mensajes de error más específicos
      if (errorMessage.includes('403') || errorMessage.includes('permisos')) {
        errorMessage = 'No tienes permisos para acceder a Google Calendar. Por favor, reconecta Google Calendar desde la página de Integraciones y asegúrate de otorgar los permisos necesarios.'
      } else if (errorMessage.includes('401') || errorMessage.includes('expirado') || errorMessage.includes('tokens no están disponibles') || errorMessage.includes('no están disponibles')) {
        errorMessage = 'Google Calendar está conectado pero los tokens expiraron o no están disponibles. Por favor, reconecta Google Calendar desde la página de Integraciones.'
      }

      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const formatEventTime = (event: CalendarEvent) => {
    const start = event.start.dateTime || event.start.date
    if (!start) return 'Sin fecha'

    const startDate = new Date(start)
    if (event.start.date && !event.start.dateTime) {
      // Evento de todo el día
      return startDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
    }

    return startDate.toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getEventDuration = (event: CalendarEvent) => {
    if (!event.start.dateTime || !event.end.dateTime) return ''

    const start = new Date(event.start.dateTime)
    const end = new Date(event.end.dateTime)
    const durationMs = end.getTime() - start.getTime()
    const durationHours = Math.floor(durationMs / (1000 * 60 * 60))
    const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))

    if (durationHours === 0) {
      return `${durationMinutes} min`
    }
    if (durationMinutes === 0) {
      return `${durationHours} h`
    }
    return `${durationHours}h ${durationMinutes}min`
  }

  if (loading) {
    return (
      <div>
        <div className="card" style={{ border: '2px solid #000' }}>
          <div className="empty-state">
            <div className="spinner"></div>
            <p>Cargando eventos...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <div className="card" style={{ border: '2px solid #000' }}>
          <div className="empty-state">
            <h3>Error</h3>
            <p>{error}</p>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'center', marginTop: 'var(--spacing-md)' }}>
              <button onClick={fetchEvents} className="btn btn--secondary">
                Reintentar
              </button>
              {(error.includes('reconecta') || error.includes('tokens') || error.includes('expirado')) && (
                <button
                  onClick={() => window.location.href = '/integrations'}
                  className="btn btn--primary"
                >
                  Ir a Integraciones
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>

      {events.length === 0 ? (
        <div className="card" style={{ border: '2px solid #000' }}>
          <div className="empty-state">
            <div style={{ margin: '0 auto var(--spacing-md)', opacity: 0.5 }}>
              <GoogleCalendarIcon size={48} color="#4285F4" />
            </div>
            <h3>No hay eventos</h3>
            <p>No hay eventos programados para este mes</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {events.map((event) => (
            <div
              key={event.id}
              style={{
                background: 'var(--color-bg)',
                border: '2px solid #000',
                borderRadius: 'var(--border-radius-lg)',
                padding: 'var(--spacing-lg)',
                transition: 'var(--transition)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--spacing-md)' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-text)' }}>
                    {event.summary || 'Sin título'}
                  </h3>

                  {event.description && (
                    <p style={{ margin: '0 0 var(--spacing-sm) 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      {event.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      <Clock size={16} />
                      <span>{formatEventTime(event)}</span>
                      {event.start.dateTime && event.end.dateTime && (
                        <span style={{ marginLeft: 'var(--spacing-xs)' }}>({getEventDuration(event)})</span>
                      )}
                    </div>

                    {event.location && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        <MapPin size={16} />
                        <span>{event.location}</span>
                      </div>
                    )}

                    {event.attendees && event.attendees.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        <User size={16} />
                        <span>
                          {event.attendees.length} {event.attendees.length === 1 ? 'participante' : 'participantes'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Calendar
