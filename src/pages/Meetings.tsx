import { useTranslation } from 'react-i18next'
import { Calendar, Clock, ExternalLink, CheckCircle, XCircle } from 'lucide-react'
import { useMeetings, type Meeting } from '../hooks/useMeetings'
import { formatDate } from '../utils/date'
import SectionHeader from '../components/SectionHeader'

export default function Meetings() {
    const { t } = useTranslation()
    const { meetings, loading, error, updateMeetingStatus } = useMeetings()

    const now = new Date()
    const upcomingMeetings = meetings.filter(m => new Date(m.meeting_date) >= now)
    const pastMeetings = meetings.filter(m => new Date(m.meeting_date) < now)

    const handleStatusChange = async (meetingId: string, newStatus: Meeting['status']) => {
        const success = await updateMeetingStatus(meetingId, newStatus)
        if (!success) {
            alert(t('meetings.errors.updateFailed'))
        }
    }

    if (loading && meetings.length === 0) {
        return (
            <div>
                <div className="card" style={{ border: '2px solid #000' }}>
                    <div className="empty-state">
                        <div className="spinner" />
                        <p>{t('meetings.loading')}</p>
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
                        <p style={{ color: 'var(--color-danger)' }}>{t('common.error')}: {error}</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div>
            <SectionHeader
                title="Meetings"
                description="View and manage scheduled appointments with your leads"
                icon={<Calendar size={24} />}
            />

            {meetings.length === 0 ? (
                <div className="card" style={{ border: '2px solid #000' }}>
                    <div className="empty-state">
                        <Calendar size={64} style={{ opacity: 0.3, margin: '0 auto var(--spacing-md)' }} />
                        <h3 style={{ marginBottom: 'var(--spacing-sm)' }}>{t('meetings.noMeetings')}</h3>
                        <p style={{ color: 'var(--color-text-secondary)' }}>
                            {t('meetings.meetingsWillAppear')}
                        </p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Upcoming meetings */}
                    {upcomingMeetings.length > 0 && (
                        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                            <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-md)', fontWeight: 600 }}>
                                {t('meetings.upcoming')} ({upcomingMeetings.length})
                            </h2>
                            <MeetingsTable
                                meetings={upcomingMeetings}
                                onStatusChange={handleStatusChange}
                                showStatusActions={false}
                            />
                        </div>
                    )}

                    {/* Past meetings */}
                    {pastMeetings.length > 0 && (
                        <div>
                            <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-md)', fontWeight: 600 }}>
                                {t('meetings.history')} ({pastMeetings.length})
                            </h2>
                            <MeetingsTable
                                meetings={pastMeetings}
                                onStatusChange={handleStatusChange}
                                showStatusActions={true}
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

function MeetingsTable({
    meetings,
    onStatusChange,
    showStatusActions,
}: {
    meetings: Meeting[]
    onStatusChange: (id: string, status: Meeting['status']) => void
    showStatusActions: boolean
}) {
    const { t } = useTranslation()

    return (
        <div className="card" style={{ padding: 0, overflow: 'auto', border: '2px solid #000' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}>
                        <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                            {t('meetings.table.name')}
                        </th>
                        <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                            {t('meetings.table.date')}
                        </th>
                        <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                            {t('meetings.table.duration')}
                        </th>
                        <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                            {t('meetings.table.status')}
                        </th>
                        <th style={{ padding: 'var(--spacing-md)', textAlign: 'right', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                            {t('meetings.table.actions')}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {meetings.map((meeting) => (
                        <MeetingRow
                            key={meeting.id}
                            meeting={meeting}
                            onStatusChange={onStatusChange}
                            showStatusActions={showStatusActions}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function MeetingRow({
    meeting,
    onStatusChange,
    showStatusActions,
}: {
    meeting: Meeting
    onStatusChange: (id: string, status: Meeting['status']) => void
    showStatusActions: boolean
}) {
    const { t } = useTranslation()
    const meetingDate = new Date(meeting.meeting_date)
    const isPast = meetingDate < new Date()

    const getStatusBadge = () => {
        const baseStyle = {
            padding: '4px 12px',
            borderRadius: 'var(--border-radius-sm)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            border: '2px solid #000',
            display: 'inline-block',
        }

        switch (meeting.status) {
            case 'completed':
                return (
                    <span style={{ ...baseStyle, backgroundColor: '#a6e3a1', color: '#000' }}>
                        {t('meetings.status.completed')}
                    </span>
                )
            case 'no_show':
                return (
                    <span style={{ ...baseStyle, backgroundColor: '#f38ba8', color: '#000' }}>
                        {t('meetings.status.noShow')}
                    </span>
                )
            case 'cancelled':
                return (
                    <span style={{ ...baseStyle, backgroundColor: '#94a3b8', color: '#000' }}>
                        {t('meetings.status.cancelled')}
                    </span>
                )
            case 'scheduled':
                if (isPast) {
                    return (
                        <span style={{ ...baseStyle, backgroundColor: '#f9e2af', color: '#000' }}>
                            {t('meetings.status.pending')}
                        </span>
                    )
                }
                return (
                    <span style={{ ...baseStyle, backgroundColor: '#89b4fa', color: '#000' }}>
                        {t('meetings.status.scheduled')}
                    </span>
                )
            default:
                return null
        }
    }

    const canUpdateStatus = meeting.status === 'scheduled' && isPast

    return (
        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            <td style={{ padding: 'var(--spacing-md)' }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                    {meeting.lead_name}
                </div>
                {meeting.lead_email && (
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        {meeting.lead_email}
                    </div>
                )}
            </td>
            <td style={{ padding: 'var(--spacing-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)' }}>
                    <Calendar size={14} style={{ color: 'var(--color-text-secondary)' }} />
                    {formatDate(meeting.meeting_date)}
                </div>
            </td>
            <td style={{ padding: 'var(--spacing-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)' }}>
                    <Clock size={14} style={{ color: 'var(--color-text-secondary)' }} />
                    {meeting.duration_minutes} {t('analytics.minutes')}
                </div>
            </td>
            <td style={{ padding: 'var(--spacing-md)' }}>
                {getStatusBadge()}
            </td>
            <td style={{ padding: 'var(--spacing-md)' }}>
                <div style={{ display: 'flex', gap: 'var(--spacing-xs)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <a
                        href={meeting.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn--sm"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-xs)',
                            fontSize: 'var(--font-size-xs)',
                            padding: '6px 12px',
                            backgroundColor: 'var(--color-primary)',
                            color: '#000',
                            textDecoration: 'none',
                        }}
                    >
                        <ExternalLink size={14} />
                        {t('meetings.actions.open')}
                    </a>

                    {showStatusActions && canUpdateStatus && (
                        <>
                            <button
                                onClick={() => onStatusChange(meeting.id, 'completed')}
                                className="btn btn--sm"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-xs)',
                                    fontSize: 'var(--font-size-xs)',
                                    padding: '6px 12px',
                                    backgroundColor: '#a6e3a1',
                                    color: '#000',
                                    border: '2px solid #000',
                                }}
                                title={t('meetings.actions.markCompleted')}
                            >
                                <CheckCircle size={14} />
                                {t('meetings.actions.showedUp')}
                            </button>
                            <button
                                onClick={() => onStatusChange(meeting.id, 'no_show')}
                                className="btn btn--sm"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-xs)',
                                    fontSize: 'var(--font-size-xs)',
                                    padding: '6px 12px',
                                    backgroundColor: '#f38ba8',
                                    color: '#000',
                                    border: '2px solid #000',
                                }}
                                title={t('meetings.actions.markNoShow')}
                            >
                                <XCircle size={14} />
                                {t('meetings.actions.noShow')}
                            </button>
                        </>
                    )}
                </div>
            </td>
        </tr>
    )
}
