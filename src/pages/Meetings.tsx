import React from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, Clock, ExternalLink, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useMeetings, type Meeting } from '../hooks/useMeetings'
import Badge from '../components/common/Badge'
import { formatDate } from '../utils/date'

export default function Meetings() {
  const { t } = useTranslation()
  const { meetings, loading, error, updateMeetingStatus } = useMeetings()

  // Separar reuniones en próximas y pasadas
  const now = new Date()
  const upcomingMeetings = meetings.filter(m => new Date(m.meeting_date) >= now && m.status === 'scheduled')
  const pastMeetings = meetings.filter(m => new Date(m.meeting_date) < now || m.status !== 'scheduled')

  const getMeetingStatusBadge = (meeting: Meeting) => {
    const meetingDate = new Date(meeting.meeting_date)
    const isPast = meetingDate < now

    if (meeting.status === 'completed') {
      return <Badge variant="success">Completada</Badge>
    } else if (meeting.status === 'cancelled') {
      return <Badge variant="secondary">Cancelada</Badge>
    } else if (meeting.status === 'no_show') {
      return <Badge variant="danger">No asistió</Badge>
    } else if (meeting.status === 'scheduled' && isPast) {
      return <Badge variant="warning">Vencida</Badge>
    } else {
      return <Badge variant="primary">Programada</Badge>
    }
  }

  const handleStatusChange = async (meetingId: string, status: Meeting['status']) => {
    const success = await updateMeetingStatus(meetingId, status)
    if (!success) {
      alert('Error al actualizar el estado de la reunión')
    }
  }

  if (loading && meetings.length === 0) {
    return (
      <div className="page-container">
        <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
          <div className="spinner" />
          <p style={{ marginTop: 'var(--spacing-md)' }}>Cargando reuniones...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-container">
        <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-danger)' }}>
          <p>Error: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">

      {meetings.length === 0 ? (
        <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
          <Calendar size={64} style={{ opacity: 0.3, margin: '0 auto var(--spacing-md)' }} />
          <h3 style={{ marginBottom: 'var(--spacing-sm)' }}>{t('meetings.noMeetings')}</h3>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            {t('meetings.meetingsWillAppear')}
          </p>
        </div>
      ) : (
        <>
          {/* Próximas reuniones */}
          {upcomingMeetings.length > 0 && (
            <div style={{ marginBottom: 'var(--spacing-xl)' }}>
              <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-md)' }}>
                {t('meetings.upcoming')} ({upcomingMeetings.length})
              </h2>
              <div className="card-grid">
                {upcomingMeetings.map(meeting => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    getBadge={() => getMeetingStatusBadge(meeting)}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Reuniones pasadas */}
          {pastMeetings.length > 0 && (
            <div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-md)' }}>
                {t('meetings.history')} ({pastMeetings.length})
              </h2>
              <div className="card-grid">
                {pastMeetings.map(meeting => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    getBadge={() => getMeetingStatusBadge(meeting)}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MeetingCard({
  meeting,
  getBadge,
  onStatusChange,
}: {
  meeting: Meeting
  getBadge: () => React.JSX.Element
  onStatusChange: (id: string, status: Meeting['status']) => void
}) {
  const meetingDate = new Date(meeting.meeting_date)
  const isPast = meetingDate < new Date()
  const canMarkComplete = isPast && meeting.status === 'scheduled'

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-md)' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 600 }}>
            {meeting.lead_name}
          </h3>
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-xs)', alignItems: 'center' }}>
            <Calendar size={14} style={{ color: 'var(--color-text-secondary)' }} />
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              {formatDate(meeting.meeting_date)}
            </span>
            <Clock size={14} style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--spacing-xs)' }} />
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              {meeting.duration_minutes} min
            </span>
          </div>
        </div>
        {getBadge()}
      </div>

      <a
        href={meeting.meeting_link}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary btn-sm"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          textDecoration: 'none',
          marginBottom: 'var(--spacing-sm)'
        }}
      >
        <ExternalLink size={16} />
        Abrir reunión
      </a>

      {canMarkComplete && (
        <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-sm)' }}>
          <button
            onClick={() => onStatusChange(meeting.id, 'completed')}
            className="btn btn-sm"
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--spacing-xs)',
              backgroundColor: 'var(--color-success)',
              color: 'white',
              border: 'none'
            }}
            title="Marcar como completada"
          >
            <CheckCircle size={16} />
            Completada
          </button>
          <button
            onClick={() => onStatusChange(meeting.id, 'no_show')}
            className="btn btn-sm"
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--spacing-xs)',
              backgroundColor: 'var(--color-danger)',
              color: 'white',
              border: 'none'
            }}
            title="Marcar como no asistió"
          >
            <XCircle size={16} />
            No asistió
          </button>
        </div>
      )}

      {meeting.status === 'scheduled' && !isPast && (
        <button
          onClick={() => onStatusChange(meeting.id, 'cancelled')}
          className="btn btn-sm"
          style={{
            width: '100%',
            marginTop: 'var(--spacing-sm)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--spacing-xs)',
            backgroundColor: 'transparent',
            border: '2px solid var(--color-border)',
            color: 'var(--color-text-secondary)'
          }}
          title="Cancelar reunión"
        >
          <AlertCircle size={16} />
          Cancelar
        </button>
      )}
    </div>
  )
}
