import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MessageSquare,
  Inbox,
  Users,
  Zap,
  Calendar,
  Brain,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useConversations } from '../hooks/useConversations'
import { useAgents } from '../hooks/useAgents'
import { useIntegrations } from '../hooks/useIntegrations'
import { useMeetings } from '../hooks/useMeetings'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

type TimeRange = 'today' | 'week' | 'month' | 'all'

function Analytics() {
  const { t } = useTranslation()
  const { conversations, loading: conversationsLoading } = useConversations()
  const { agents, loading: agentsLoading } = useAgents()
  const { integrations, loading: integrationsLoading } = useIntegrations()
  const { meetings, loading: meetingsLoading } = useMeetings()

  const [timeRange, setTimeRange] = useState<TimeRange>('week')

  const loading = conversationsLoading || agentsLoading || integrationsLoading || meetingsLoading

  // Calcular métricas basadas en el rango de tiempo seleccionado
  const metrics = useMemo(() => {
    const now = new Date()
    let startDate = new Date()

    switch (timeRange) {
      case 'today':
        startDate.setHours(0, 0, 0, 0)
        break
      case 'week':
        startDate.setDate(now.getDate() - 7)
        break
      case 'month':
        startDate.setDate(now.getDate() - 30)
        break
      case 'all':
        startDate = new Date(0) // Desde el inicio
        break
    }

    const filteredConversations = conversations.filter(conv => {
      const convDate = new Date(conv.created_at)
      return convDate >= startDate
    })

    // Conversaciones totales
    const totalConversations = filteredConversations.length

    // Conversaciones activas (con mensajes no leídos)
    const activeConversations = filteredConversations.filter(conv => conv.unread_count > 0).length

    // Conversaciones por plataforma
    const whatsappConversations = filteredConversations.filter(conv => conv.platform === 'whatsapp').length
    const instagramConversations = filteredConversations.filter(conv => conv.platform === 'instagram').length

    // Mensajes totales estimados (basado en unread_count)
    const totalMessages = filteredConversations.reduce((sum, conv) => sum + conv.unread_count, 0)

    // Conversaciones con agente asignado
    const conversationsWithAgent = filteredConversations.filter(conv => conv.agent_id).length

    // Tasa de respuesta (conversaciones con agente / total)
    const responseRate = totalConversations > 0
      ? Math.round((conversationsWithAgent / totalConversations) * 100)
      : 0

    // Agentes activos
    const activeAgents = agents.filter(agent => agent.platform !== null).length

    // Integraciones conectadas
    const connectedIntegrations = integrations.filter(int => int.status === 'connected').length

    // Métricas de reuniones
    const filteredMeetings = meetings.filter(m => {
      const meetingDate = new Date(m.meeting_date)
      return meetingDate >= startDate
    })

    const upcomingMeetings = meetings.filter(m => {
      const meetingDate = new Date(m.meeting_date)
      return meetingDate >= now && m.status === 'scheduled'
    }).length

    const todayMeetings = meetings.filter(m => {
      const meetingDate = new Date(m.meeting_date)
      const today = new Date()
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
      return meetingDate >= todayStart && meetingDate < todayEnd && m.status === 'scheduled'
    }).length

    // Métricas de meetings en el período seleccionado
    const totalMeetings = filteredMeetings.length
    const completedMeetings = filteredMeetings.filter(m => m.status === 'completed').length
    const noShowMeetings = filteredMeetings.filter(m => m.status === 'no_show').length
    const scheduledMeetings = filteredMeetings.filter(m => m.status === 'scheduled').length

    // Calcular tasa de asistencia (completed / (completed + no_show))
    const totalFinishedMeetings = completedMeetings + noShowMeetings
    const showRate = totalFinishedMeetings > 0
      ? Math.round((completedMeetings / totalFinishedMeetings) * 100)
      : 0

    // Conversaciones por día (últimos 21 días)
    const conversationsByDay = Array.from({ length: 21 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (20 - i))
      date.setHours(0, 0, 0, 0)
      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)

      const dayConversations = filteredConversations.filter(conv => {
        const convDate = new Date(conv.created_at)
        return convDate >= date && convDate < nextDay
      })

      return {
        date: date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        whatsapp: dayConversations.filter(conv => conv.platform === 'whatsapp').length,
        instagram: dayConversations.filter(conv => conv.platform === 'instagram').length
      }
    })

    // Conversaciones por agente
    const conversationsByAgent = agents.map(agent => {
      const count = filteredConversations.filter(conv => conv.agent_id === agent.id).length
      return {
        agentName: agent.name,
        count,
        platform: agent.platform
      }
    }).filter(item => item.count > 0).sort((a, b) => b.count - a.count)

    // Comparación con período anterior
    const previousStartDate = new Date(startDate)
    const previousEndDate = new Date(startDate)
    const daysDiff = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    previousStartDate.setDate(previousStartDate.getDate() - daysDiff)
    previousEndDate.setDate(previousEndDate.getDate() - daysDiff)

    const previousConversations = conversations.filter(conv => {
      const convDate = new Date(conv.created_at)
      return convDate >= previousStartDate && convDate < previousEndDate
    }).length

    const conversationGrowth = previousConversations > 0
      ? Math.round(((totalConversations - previousConversations) / previousConversations) * 100)
      : totalConversations > 0 ? 100 : 0

    return {
      totalConversations,
      activeConversations,
      whatsappConversations,
      instagramConversations,
      totalMessages,
      conversationsWithAgent,
      responseRate,
      activeAgents,
      connectedIntegrations,
      conversationsByDay,
      conversationsByAgent,
      conversationGrowth,
      upcomingMeetings,
      todayMeetings,
      totalMeetings,
      completedMeetings,
      noShowMeetings,
      scheduledMeetings,
      showRate
    }
  }, [conversations, agents, integrations, meetings, timeRange])

  if (loading) {
    return (
      <div>
        <div className="card">
          <div className="empty-state">
            <div className="spinner"></div>
            <p>{t('analytics.loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>

      {/* Filtro de tiempo */}
      <div className="card" style={{ marginBottom: 'var(--spacing-md)', border: '2px solid #000' }}>
        <div className="flex items-center" style={{ flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('analytics.period')}</span>
          {(['today', 'week', 'month', 'all'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`btn ${timeRange === range ? 'btn--primary' : 'btn--ghost'}`}
              style={{ fontSize: 'var(--font-size-sm)', padding: 'var(--spacing-xs) var(--spacing-md)' }}
            >
              {t(`analytics.${range}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--spacing-md)' }}>
        <div className="card" style={{ border: '2px solid #000' }}>
          <h3 className="card-title" style={{ margin: 0, marginBottom: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {t('analytics.metrics.conversations')}
          </h3>
          <div className="flex items-center justify-between" style={{ alignItems: 'center' }}>
            <div className="flex items-center" style={{ gap: 'var(--spacing-md)', alignItems: 'center' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--border-radius)',
                background: 'rgba(137, 180, 250, 0.15)',
                border: '2px solid #000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <MessageSquare size={24} color="var(--color-primary)" />
              </div>
              <p style={{ fontSize: '2rem', margin: 0, fontWeight: 700, color: 'var(--color-text)' }}>
                {metrics.totalConversations}
              </p>
            </div>
            {metrics.conversationGrowth !== 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: metrics.conversationGrowth > 0 ? 'var(--color-success)' : 'var(--color-danger)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                flexShrink: 0
              }}>
                {metrics.conversationGrowth > 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                {Math.abs(metrics.conversationGrowth)}%
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ border: '2px solid #000' }}>
          <h3 className="card-title" style={{ margin: 0, marginBottom: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {t('analytics.metrics.responseRate')}
          </h3>
          <div className="flex items-center" style={{ gap: 'var(--spacing-md)', alignItems: 'center' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--border-radius)',
              background: 'rgba(166, 227, 161, 0.15)',
              border: '2px solid #000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Zap size={24} color="var(--color-success)" />
            </div>
            <p style={{ fontSize: '2rem', margin: 0, fontWeight: 700, color: 'var(--color-success)' }}>
              {metrics.responseRate}%
            </p>
          </div>
        </div>

        <div className="card" style={{ border: '2px solid #000' }}>
          <h3 className="card-title" style={{ margin: 0, marginBottom: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {t('analytics.metrics.messages')}
          </h3>
          <div className="flex items-center" style={{ gap: 'var(--spacing-md)', alignItems: 'center' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--border-radius)',
              background: 'rgba(249, 226, 175, 0.15)',
              border: '2px solid #000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Inbox size={24} color="var(--color-warning)" />
            </div>
            <p style={{ fontSize: '2rem', margin: 0, fontWeight: 700, color: 'var(--color-warning)' }}>
              {metrics.totalMessages}
            </p>
          </div>
        </div>

        <div className="card" style={{ border: '2px solid #000' }}>
          <h3 className="card-title" style={{ margin: 0, marginBottom: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {t('analytics.metrics.activeAgents')}
          </h3>
          <div className="flex items-center" style={{ gap: 'var(--spacing-md)', alignItems: 'center' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--border-radius)',
              background: 'rgba(137, 180, 250, 0.15)',
              border: '2px solid #000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Brain size={24} color="var(--color-primary)" />
            </div>
            <p style={{ fontSize: '2rem', margin: 0, fontWeight: 700, color: 'var(--color-text)' }}>
              {metrics.activeAgents}
            </p>
          </div>
        </div>

        <div className="card" style={{ border: '2px solid #000' }}>
          <h3 className="card-title" style={{ margin: 0, marginBottom: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {t('analytics.metrics.todayMeetings')}
          </h3>
          <div className="flex items-center" style={{ gap: 'var(--spacing-md)', alignItems: 'center' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--border-radius)',
              background: 'rgba(166, 227, 161, 0.15)',
              border: '2px solid #000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Calendar size={24} color="var(--color-success)" />
            </div>
            <p style={{ fontSize: '2rem', margin: 0, fontWeight: 700, color: 'var(--color-success)' }}>
              {metrics.todayMeetings}
            </p>
          </div>
        </div>

        <div className="card" style={{ border: '2px solid #000' }}>
          <h3 className="card-title" style={{ margin: 0, marginBottom: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {t('analytics.metrics.upcomingMeetings')}
          </h3>
          <div className="flex items-center" style={{ gap: 'var(--spacing-md)', alignItems: 'center' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--border-radius)',
              background: 'rgba(249, 226, 175, 0.15)',
              border: '2px solid #000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Calendar size={24} color="var(--color-warning)" />
            </div>
            <p style={{ fontSize: '2rem', margin: 0, fontWeight: 700, color: 'var(--color-warning)' }}>
              {metrics.upcomingMeetings}
            </p>
          </div>
        </div>

        <div className="card" style={{ border: '2px solid #000' }}>
          <h3 className="card-title" style={{ margin: 0, marginBottom: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {t('analytics.metrics.showRate')}
          </h3>
          <div className="flex items-center" style={{ gap: 'var(--spacing-md)', alignItems: 'center' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--border-radius)',
              background: 'rgba(166, 227, 161, 0.15)',
              border: '2px solid #000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Calendar size={24} color="var(--color-success)" />
            </div>
            <p style={{ fontSize: '2rem', margin: 0, fontWeight: 700, color: 'var(--color-success)' }}>
              {metrics.showRate}%
            </p>
          </div>
        </div>

        <div className="card" style={{ border: '2px solid #000' }}>
          <h3 className="card-title" style={{ margin: 0, marginBottom: 'var(--spacing-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {t('analytics.metrics.totalMeetings')}
          </h3>
          <div className="flex items-center" style={{ gap: 'var(--spacing-md)', alignItems: 'center' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--border-radius)',
              background: 'rgba(137, 180, 250, 0.15)',
              border: '2px solid #000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Calendar size={24} color="var(--color-primary)" />
            </div>
            <p style={{ fontSize: '2rem', margin: 0, fontWeight: 700, color: 'var(--color-text)' }}>
              {metrics.totalMeetings}
            </p>
          </div>
          <div style={{ marginTop: 'var(--spacing-sm)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>{t('analytics.metrics.completedMeetings')}: {metrics.completedMeetings}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('analytics.metrics.noShowMeetings')}: {metrics.noShowMeetings}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico de actividad */}
      <div className="card" style={{ marginTop: 'var(--spacing-md)', border: '2px solid #000' }}>
        <h3 className="card-title flex items-center" style={{ gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
          <Calendar size={20} />
          {t('analytics.activity')}
        </h3>
        <ChartContainer
          config={{
            whatsapp: {
              label: "WhatsApp",
              color: "#a6e3a1",
            },
            instagram: {
              label: "Instagram",
              color: "#f38ba8",
            },
          } satisfies ChartConfig}
          style={{ height: '300px' }}
        >
          <BarChart
            accessibilityLayer
            data={metrics.conversationsByDay}
            margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="#e5e5e5"
              strokeWidth={1}
              strokeDasharray="0"
              horizontalPoints={[]}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tick={{ fill: 'var(--color-text)', fontWeight: 600, fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--color-text)', fontWeight: 600, fontSize: 12 }}
              width={30}
              allowDecimals={false}
              domain={[0, 'dataMax']}
              tickFormatter={(value) => {
                const intValue = Math.floor(value)
                return intValue > 0 ? intValue.toString() : ''
              }}
            />
            <ChartTooltip
              cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
              content={<ChartTooltipContent indicator="dot" formatter={(value) => {
                const intValue = Math.floor(Number(value))
                return intValue > 0 ? intValue.toString() : ''
              }} />}
            />
            <Bar
              dataKey="whatsapp"
              fill="var(--color-whatsapp)"
              radius={4}
              stroke="#000"
              strokeWidth={3}
            />
            <Bar
              dataKey="instagram"
              fill="var(--color-instagram)"
              radius={4}
              stroke="#000"
              strokeWidth={3}
            />
          </BarChart>
        </ChartContainer>
      </div>

      {/* Próximas reuniones */}
      {metrics.upcomingMeetings > 0 && (
        <div className="card" style={{ marginTop: 'var(--spacing-md)', border: '2px solid #000' }}>
          <h3 className="card-title flex items-center" style={{ gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
            <Calendar size={20} />
            {t('analytics.metrics.upcomingMeetings')} ({metrics.upcomingMeetings})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {meetings
              .filter(m => {
                const meetingDate = new Date(m.meeting_date)
                return meetingDate >= new Date() && m.status === 'scheduled'
              })
              .sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime())
              .slice(0, 5) // Mostrar máximo 5 reuniones
              .map(meeting => (
                <div key={meeting.id} className="flex items-center justify-between" style={{ padding: 'var(--spacing-sm)', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius)', background: 'var(--color-bg-secondary)' }}>
                  <div className="flex items-center" style={{ gap: 'var(--spacing-sm)' }}>
                    <Calendar size={16} color="var(--color-primary)" />
                    <div>
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
                        {meeting.lead_name}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        {new Date(meeting.meeting_date).toLocaleDateString('es-ES', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })} • {meeting.duration_minutes} {t('analytics.minutes')}
                      </div>
                    </div>
                  </div>
                  <a
                    href={meeting.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--primary btn--sm"
                    style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px' }}
                  >
                    {t('analytics.joinMeeting')}
                  </a>
                </div>
              ))}
          </div>
          {metrics.upcomingMeetings > 5 && (
            <div style={{ textAlign: 'center', marginTop: 'var(--spacing-md)' }}>
              <a href="/meetings" className="btn btn--ghost" style={{ fontSize: 'var(--font-size-sm)' }}>
                {t('analytics.viewAllMeetings')}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Conversaciones por agente */}
      {metrics.conversationsByAgent.length > 0 && (
        <div className="card" style={{ marginTop: 'var(--spacing-md)', border: '2px solid #000' }}>
          <h3 className="card-title flex items-center" style={{ gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
            <Users size={20} />
            {t('analytics.conversationsByAgent')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {metrics.conversationsByAgent.map((item, index) => (
              <div key={index}>
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--spacing-sm)' }}>
                  <div className="flex items-center" style={{ gap: 'var(--spacing-sm)' }}>
                    <Brain size={16} color="var(--color-primary)" />
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)', fontWeight: 500 }}>
                      {item.agentName}
                    </span>
                    {item.platform && (
                      <span style={{
                        fontSize: 'var(--font-size-xs)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: item.platform === 'whatsapp' ? 'rgba(166, 227, 161, 0.2)' : 'rgba(243, 139, 168, 0.2)',
                        color: item.platform === 'whatsapp' ? '#a6e3a1' : '#f38ba8'
                      }}>
                        {item.platform === 'whatsapp' ? 'WA' : 'IG'}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-text)' }}>
                    {item.count}
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '6px',
                  background: 'var(--color-bg-secondary)',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${metrics.totalConversations > 0 ? (item.count / metrics.totalConversations) * 100 : 0}%`,
                    height: '100%',
                    background: 'var(--color-primary)',
                    borderRadius: '3px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {metrics.totalConversations === 0 && (
        <div className="card" style={{ marginTop: 'var(--spacing-md)', border: '2px solid #000' }}>
          <div className="empty-state">
            <h3>{t('analytics.empty.title')}</h3>
            <p>{t('analytics.empty.description')}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default Analytics
