import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MessageSquare,
  TrendingUp,
  Calendar,
  CheckCircle,
  XCircle,
  Target,
  Zap
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useConversations } from '../hooks/useConversations'
import { useAgents } from '../hooks/useAgents'
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
  const { agents } = useAgents()
  const { meetings, loading: meetingsLoading } = useMeetings()

  const [timeRange, setTimeRange] = useState<TimeRange>('week')

  const loading = conversationsLoading || meetingsLoading

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
        startDate = new Date(0)
        break
    }

    const filteredConversations = conversations.filter(conv => {
      const convDate = new Date(conv.created_at)
      return convDate >= startDate
    })

    // === LEAD METRICS ===
    const totalLeads = filteredConversations.length
    const coldLeads = filteredConversations.filter(c => c.lead_status === 'cold').length
    const warmLeads = filteredConversations.filter(c => c.lead_status === 'warm').length
    const hotLeads = filteredConversations.filter(c => c.lead_status === 'hot').length
    const closedLeads = filteredConversations.filter(c => c.lead_status === 'closed').length
    const notClosedLeads = filteredConversations.filter(c => c.lead_status === 'not_closed').length

    // Qualified Lead Rate: (hot + closed) / total
    const qualifiedLeads = hotLeads + closedLeads
    const qualifiedLeadRate = totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0

    // Close Rate: closed / (hot + closed + not_closed)
    const opportunities = hotLeads + closedLeads + notClosedLeads
    const closeRate = opportunities > 0 ? Math.round((closedLeads / opportunities) * 100) : 0

    // Response Rate: conversaciones con agente / total
    const conversationsWithAgent = filteredConversations.filter(conv => conv.agent_id).length
    const responseRate = totalLeads > 0 ? Math.round((conversationsWithAgent / totalLeads) * 100) : 0

    // === MEETING METRICS ===
    const filteredMeetings = meetings.filter(m => {
      const meetingDate = new Date(m.meeting_date)
      return meetingDate >= startDate
    })

    const totalMeetings = filteredMeetings.length
    const completedMeetings = filteredMeetings.filter(m => m.status === 'completed').length
    const noShowMeetings = filteredMeetings.filter(m => m.status === 'no_show').length
    const upcomingMeetings = meetings.filter(m => {
      const meetingDate = new Date(m.meeting_date)
      return meetingDate >= now && m.status === 'scheduled'
    }).length

    // Show Rate: completed / (completed + no_show)
    const totalFinishedMeetings = completedMeetings + noShowMeetings
    const showRate = totalFinishedMeetings > 0
      ? Math.round((completedMeetings / totalFinishedMeetings) * 100)
      : 0

    // Conversion to Meeting: total meetings / total leads
    const conversionToMeeting = totalLeads > 0 ? Math.round((totalMeetings / totalLeads) * 100) : 0

    // === ACTIVITY CHART ===
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

    return {
      // Leads
      totalLeads,
      coldLeads,
      warmLeads,
      hotLeads,
      closedLeads,
      qualifiedLeadRate,
      closeRate,
      responseRate,
      // Meetings
      totalMeetings,
      completedMeetings,
      noShowMeetings,
      upcomingMeetings,
      showRate,
      conversionToMeeting,
      // Chart
      conversationsByDay
    }
  }, [conversations, agents, meetings, timeRange])

  if (loading) {
    return (
      <div>
        <div className="card" style={{ border: '2px solid #000' }}>
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
      {/* Time Filter */}
      <div className="card" style={{ marginBottom: 'var(--spacing-lg)', border: '2px solid #000', padding: 'var(--spacing-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
            {t('analytics.period')}
          </span>
          {(['today', 'week', 'month', 'all'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className="btn btn--sm"
              style={{
                fontSize: 'var(--font-size-xs)',
                padding: '6px 12px',
                backgroundColor: timeRange === range ? 'var(--color-primary)' : 'transparent',
                color: timeRange === range ? '#000' : 'var(--color-text)',
                fontWeight: 600
              }}
            >
              {t(`analytics.${range}`)}
            </button>
          ))}
        </div>
      </div>

      {/* SALES & LEADS SECTION */}
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h2 style={{
          fontSize: 'var(--font-size-xl)',
          fontWeight: 700,
          marginBottom: 'var(--spacing-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          color: 'var(--color-text)'
        }}>
          <TrendingUp size={24} />
          Sales & Lead Performance
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-lg)'
        }}>
          {/* Total Leads */}
          <div className="card" style={{
            border: '2px solid #000',
            padding: 'var(--spacing-md)',
            backgroundColor: 'rgba(137, 180, 250, 0.1)'
          }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Leads
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--color-primary)', lineHeight: 1 }}>
              {metrics.totalLeads}
            </div>
          </div>

          {/* Qualified Lead Rate */}
          <div className="card" style={{
            border: '2px solid #000',
            padding: 'var(--spacing-md)',
            backgroundColor: 'rgba(166, 227, 161, 0.1)'
          }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Qualified Rate
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#a6e3a1', lineHeight: 1 }}>
              {metrics.qualifiedLeadRate}%
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              {metrics.hotLeads + metrics.closedLeads} hot/closed
            </div>
          </div>

          {/* Close Rate */}
          <div className="card" style={{
            border: '2px solid #000',
            padding: 'var(--spacing-md)',
            backgroundColor: 'rgba(166, 227, 161, 0.15)'
          }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Close Rate
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#a6e3a1', lineHeight: 1 }}>
              {metrics.closeRate}%
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              {metrics.closedLeads} closed deals
            </div>
          </div>

          {/* Response Rate */}
          <div className="card" style={{
            border: '2px solid #000',
            padding: 'var(--spacing-md)',
            backgroundColor: 'rgba(249, 226, 175, 0.1)'
          }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Response Rate
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#f9e2af', lineHeight: 1 }}>
              {metrics.responseRate}%
            </div>
          </div>
        </div>

        {/* Lead Distribution */}
        <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-lg)' }}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <Target size={18} />
            Lead Distribution
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--spacing-md)' }}>
            <div style={{ textAlign: 'center', padding: 'var(--spacing-md)', backgroundColor: 'rgba(148, 163, 184, 0.1)', border: '2px solid #000', borderRadius: 'var(--border-radius)' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#94a3b8' }}>{metrics.coldLeads}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '4px' }}>Cold</div>
            </div>
            <div style={{ textAlign: 'center', padding: 'var(--spacing-md)', backgroundColor: 'rgba(249, 226, 175, 0.1)', border: '2px solid #000', borderRadius: 'var(--border-radius)' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f9e2af' }}>{metrics.warmLeads}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '4px' }}>Warm</div>
            </div>
            <div style={{ textAlign: 'center', padding: 'var(--spacing-md)', backgroundColor: 'rgba(243, 139, 168, 0.1)', border: '2px solid #000', borderRadius: 'var(--border-radius)' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f38ba8' }}>{metrics.hotLeads}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '4px' }}>Hot</div>
            </div>
            <div style={{ textAlign: 'center', padding: 'var(--spacing-md)', backgroundColor: 'rgba(166, 227, 161, 0.1)', border: '2px solid #000', borderRadius: 'var(--border-radius)' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#a6e3a1' }}>{metrics.closedLeads}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '4px' }}>Closed</div>
            </div>
          </div>
        </div>
      </div>

      {/* MEETINGS SECTION */}
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <h2 style={{
          fontSize: 'var(--font-size-xl)',
          fontWeight: 700,
          marginBottom: 'var(--spacing-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          color: 'var(--color-text)'
        }}>
          <Calendar size={24} />
          Appointment Performance
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--spacing-md)'
        }}>
          {/* Total Meetings */}
          <div className="card" style={{
            border: '2px solid #000',
            padding: 'var(--spacing-md)',
            backgroundColor: 'rgba(137, 180, 250, 0.1)'
          }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Meetings
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--color-primary)', lineHeight: 1 }}>
              {metrics.totalMeetings}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px', display: 'flex', gap: 'var(--spacing-xs)' }}>
              <span><CheckCircle size={12} style={{ display: 'inline', marginRight: '2px' }} />{metrics.completedMeetings}</span>
              <span><XCircle size={12} style={{ display: 'inline', marginRight: '2px' }} />{metrics.noShowMeetings}</span>
            </div>
          </div>

          {/* Show Rate */}
          <div className="card" style={{
            border: '2px solid #000',
            padding: 'var(--spacing-md)',
            backgroundColor: 'rgba(166, 227, 161, 0.15)'
          }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Show Rate
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#a6e3a1', lineHeight: 1 }}>
              {metrics.showRate}%
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              {metrics.showRate >= 95 ? '🎯 Excellent' : metrics.showRate >= 80 ? '✓ Good' : '⚠ Needs improvement'}
            </div>
          </div>

          {/* Upcoming Meetings */}
          <div className="card" style={{
            border: '2px solid #000',
            padding: 'var(--spacing-md)',
            backgroundColor: 'rgba(249, 226, 175, 0.1)'
          }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Upcoming
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#f9e2af', lineHeight: 1 }}>
              {metrics.upcomingMeetings}
            </div>
          </div>

          {/* Conversion to Meeting */}
          <div className="card" style={{
            border: '2px solid #000',
            padding: 'var(--spacing-md)',
            backgroundColor: 'rgba(137, 180, 250, 0.1)'
          }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Lead → Meeting
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--color-primary)', lineHeight: 1 }}>
              {metrics.conversionToMeeting}%
            </div>
          </div>
        </div>
      </div>

      {/* ACTIVITY CHART */}
      <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-lg)' }}>
        <h3 style={{
          fontSize: 'var(--font-size-base)',
          fontWeight: 600,
          marginBottom: 'var(--spacing-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)'
        }}>
          <MessageSquare size={18} />
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
          style={{ height: '280px' }}
        >
          <BarChart
            accessibilityLayer
            data={metrics.conversationsByDay}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="#e5e5e5"
              strokeWidth={1}
              strokeDasharray="0"
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tick={{ fill: 'var(--color-text)', fontWeight: 600, fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--color-text)', fontWeight: 600, fontSize: 11 }}
              width={30}
              allowDecimals={false}
            />
            <ChartTooltip
              cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Bar
              dataKey="whatsapp"
              fill="#a6e3a1"
              radius={4}
              stroke="#000"
              strokeWidth={2}
            />
            <Bar
              dataKey="instagram"
              fill="#f38ba8"
              radius={4}
              stroke="#000"
              strokeWidth={2}
            />
          </BarChart>
        </ChartContainer>
      </div>

      {/* Empty State */}
      {metrics.totalLeads === 0 && (
        <div className="card" style={{ marginTop: 'var(--spacing-md)', border: '2px solid #000' }}>
          <div className="empty-state">
            <Zap size={48} style={{ opacity: 0.3, margin: '0 auto var(--spacing-md)' }} />
            <h3>{t('analytics.empty.title')}</h3>
            <p>{t('analytics.empty.description')}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default Analytics
