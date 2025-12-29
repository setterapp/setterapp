import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, BarChart3 } from 'lucide-react'
import SectionHeader from '../components/SectionHeader'
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

    const totalLeads = filteredConversations.length
    const bookedLeads = filteredConversations.filter(c => c.lead_status === 'booked').length
    const closedLeads = filteredConversations.filter(c => c.lead_status === 'closed').length
    const notClosedLeads = filteredConversations.filter(c => c.lead_status === 'not_closed').length

    const opportunities = bookedLeads + closedLeads + notClosedLeads
    const closeRate = opportunities > 0 ? Math.round((closedLeads / opportunities) * 100) : 0

    const filteredMeetings = meetings.filter(m => {
      const meetingDate = new Date(m.meeting_date)
      return meetingDate >= startDate
    })

    const totalMeetings = filteredMeetings.length
    const completedMeetings = filteredMeetings.filter(m => m.status === 'completed').length
    const noShowMeetings = filteredMeetings.filter(m => m.status === 'no_show').length

    const totalFinishedMeetings = completedMeetings + noShowMeetings
    const showRate = totalFinishedMeetings > 0
      ? Math.round((completedMeetings / totalFinishedMeetings) * 100)
      : 0

    // Dynamic chart based on time range
    let conversationsByDay: { date: string; whatsapp: number; instagram: number }[]

    if (timeRange === 'today') {
      // Show by hours for today
      conversationsByDay = Array.from({ length: 24 }, (_, i) => {
        const date = new Date()
        date.setHours(i, 0, 0, 0)
        const nextHour = new Date(date)
        nextHour.setHours(i + 1, 0, 0, 0)

        const hourConversations = conversations.filter(conv => {
          const convDate = new Date(conv.created_at)
          return convDate >= date && convDate < nextHour
        })

        return {
          date: `${i}:00`,
          whatsapp: hourConversations.filter(conv => conv.platform === 'whatsapp').length,
          instagram: hourConversations.filter(conv => conv.platform === 'instagram').length
        }
      })
    } else {
      const chartDays = timeRange === 'week' ? 7 : 30

      conversationsByDay = Array.from({ length: chartDays }, (_, i) => {
        const date = new Date()
        date.setDate(date.getDate() - (chartDays - 1 - i))
        date.setHours(0, 0, 0, 0)
        const nextDay = new Date(date)
        nextDay.setDate(nextDay.getDate() + 1)

        const dayConversations = conversations.filter(conv => {
          const convDate = new Date(conv.created_at)
          return convDate >= date && convDate < nextDay
        })

        return {
          date: date.getDate().toString(),
          whatsapp: dayConversations.filter(conv => conv.platform === 'whatsapp').length,
          instagram: dayConversations.filter(conv => conv.platform === 'instagram').length
        }
      })
    }

    return {
      totalLeads,
      closeRate,
      totalMeetings,
      showRate,
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
      {/* Section Header with Time Filter */}
      <SectionHeader title="Analytics" icon={<BarChart3 size={24} />}>
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
      </SectionHeader>

      {/* Main Analytics Container */}
      <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-xl)', backgroundColor: '#fff' }}>
        {/* Key Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: 'var(--spacing-md)', marginBottom: '48px' }}>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)', backgroundColor: 'rgba(137, 180, 250, 0.1)', border: '2px solid #000', borderRadius: 'var(--border-radius)' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#000' }}>{metrics.totalLeads}</div>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Leads</div>
          </div>

          <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)', backgroundColor: 'rgba(166, 227, 161, 0.1)', border: '2px solid #000', borderRadius: 'var(--border-radius)' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#000' }}>{metrics.closeRate}%</div>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Close Rate</div>
          </div>

          <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)', backgroundColor: 'rgba(249, 226, 175, 0.1)', border: '2px solid #000', borderRadius: 'var(--border-radius)' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#000' }}>{metrics.totalMeetings}</div>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Meetings</div>
          </div>

          <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)', backgroundColor: 'rgba(243, 139, 168, 0.1)', border: '2px solid #000', borderRadius: 'var(--border-radius)' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#000' }}>{metrics.showRate}%</div>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Show Rate</div>
          </div>
        </div>

        {/* ACTIVITY CHART */}
        <div>
          <h3 style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 700,
            marginBottom: 'var(--spacing-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            color: 'var(--color-text)'
          }}>
            <MessageSquare size={20} />
            {timeRange === 'today' ? t('analytics.activityToday') :
             timeRange === 'week' ? t('analytics.activityWeek') :
             t('analytics.activityMonth')}
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
            style={{ height: 'clamp(200px, 40vh, 280px)', width: '100%' }}
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
      </div>

    </div>
  )
}

export default Analytics
