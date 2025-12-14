import { useState, useMemo } from 'react'
import {
  BarChart3,
  MessageSquare,
  Inbox,
  Users,
  Zap,
  Calendar,
  Brain,
  ArrowUp,
  ArrowDown,
  RefreshCcw
} from 'lucide-react'
import { useConversations } from '../hooks/useConversations'
import { useAgents } from '../hooks/useAgents'
import { useIntegrations } from '../hooks/useIntegrations'
import WhatsAppIcon from '../components/icons/WhatsAppIcon'
import InstagramIcon from '../components/icons/InstagramIcon'

type TimeRange = 'today' | 'week' | 'month' | 'all'

function Analytics() {
  const { conversations, loading: conversationsLoading } = useConversations()
  const { agents, loading: agentsLoading } = useAgents()
  const { integrations, loading: integrationsLoading } = useIntegrations()

  const [timeRange, setTimeRange] = useState<TimeRange>('week')
  const [refreshing, setRefreshing] = useState(false)

  const loading = conversationsLoading || agentsLoading || integrationsLoading

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

    // Conversaciones por día (últimos 7 días)
    const conversationsByDay = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      date.setHours(0, 0, 0, 0)
      const nextDay = new Date(date)
      nextDay.setDate(nextDay.getDate() + 1)

      return {
        date: date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        count: filteredConversations.filter(conv => {
          const convDate = new Date(conv.created_at)
          return convDate >= date && convDate < nextDay
        }).length
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
      conversationGrowth
    }
  }, [conversations, agents, integrations, timeRange])

  const handleRefresh = async () => {
    setRefreshing(true)
    // Simular refresh
    setTimeout(() => setRefreshing(false), 1000)
  }

  const maxDayCount = Math.max(...metrics.conversationsByDay.map(d => d.count), 1)

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h2 className="flex items-center gap-md">
            <BarChart3 size={28} />
            Analíticas
          </h2>
        </div>
        <div className="card">
          <div className="empty-state">
            <div className="spinner"></div>
            <p>Cargando analíticas...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="flex items-center" style={{ gap: 'var(--spacing-md)' }}>
              <BarChart3 size={28} />
              Analíticas
            </h2>
            <p>Métricas y estadísticas de tus conversaciones y agentes</p>
          </div>
          <button
            onClick={handleRefresh}
            className="btn btn--secondary"
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}
          >
            <RefreshCcw
              size={18}
              style={refreshing ? {
                animation: 'spin 1s linear infinite',
                transformOrigin: 'center'
              } : {}}
            />
            Actualizar
          </button>
        </div>
      </div>

      {/* Filtro de tiempo */}
      <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
        <div className="flex items-center" style={{ flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Período:</span>
          {(['today', 'week', 'month', 'all'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`btn ${timeRange === range ? 'btn--primary' : 'btn--ghost'}`}
              style={{ fontSize: 'var(--font-size-sm)', padding: 'var(--spacing-xs) var(--spacing-md)' }}
            >
              {range === 'today' && 'Hoy'}
              {range === 'week' && '7 días'}
              {range === 'month' && '30 días'}
              {range === 'all' && 'Todo'}
            </button>
          ))}
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--spacing-md)' }}>
        <div className="card">
          <div className="flex items-center justify-between" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div className="flex items-center" style={{ gap: 'var(--spacing-md)' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--border-radius)',
                background: 'rgba(137, 180, 250, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <MessageSquare size={24} color="var(--color-primary)" />
              </div>
              <div>
                <h3 className="card-title" style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  Conversaciones
                </h3>
                <p style={{ fontSize: '2rem', margin: 0, fontWeight: 700, color: 'var(--color-text)' }}>
                  {metrics.totalConversations}
                </p>
              </div>
            </div>
            {metrics.conversationGrowth !== 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: metrics.conversationGrowth > 0 ? 'var(--color-success)' : 'var(--color-danger)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600
              }}>
                {metrics.conversationGrowth > 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                {Math.abs(metrics.conversationGrowth)}%
              </div>
            )}
          </div>
          <p className="text-secondary text-sm">
            {metrics.activeConversations} activas
          </p>
        </div>

        <div className="card">
          <div className="flex items-center" style={{ gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--border-radius)',
                background: 'rgba(166, 227, 161, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Zap size={24} color="var(--color-success)" />
              </div>
            <div>
              <h3 className="card-title" style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                Tasa de Respuesta
              </h3>
              <p style={{ fontSize: '2rem', margin: 0, fontWeight: 700, color: 'var(--color-success)' }}>
                {metrics.responseRate}%
              </p>
            </div>
          </div>
          <p className="text-secondary text-sm">
            {metrics.conversationsWithAgent} con agente asignado
          </p>
        </div>

        <div className="card">
          <div className="flex items-center" style={{ gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--border-radius)',
                background: 'rgba(249, 226, 175, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Inbox size={24} color="var(--color-warning)" />
              </div>
            <div>
              <h3 className="card-title" style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                Mensajes
              </h3>
              <p style={{ fontSize: '2rem', margin: 0, fontWeight: 700, color: 'var(--color-warning)' }}>
                {metrics.totalMessages}
              </p>
            </div>
          </div>
          <p className="text-secondary text-sm">
            Mensajes no leídos
          </p>
        </div>

        <div className="card">
          <div className="flex items-center" style={{ gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--border-radius)',
                background: 'rgba(137, 180, 250, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Brain size={24} color="var(--color-primary)" />
              </div>
            <div>
              <h3 className="card-title" style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                Agentes Activos
              </h3>
              <p style={{ fontSize: '2rem', margin: 0, fontWeight: 700, color: 'var(--color-text)' }}>
                {metrics.activeAgents}
              </p>
            </div>
          </div>
          <p className="text-secondary text-sm">
            {agents.length} agentes totales
          </p>
        </div>
      </div>

      {/* Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
        {/* Conversaciones por plataforma */}
        <div className="card">
          <h3 className="card-title flex items-center" style={{ gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
            <BarChart3 size={20} />
            Conversaciones por Plataforma
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: 'var(--spacing-sm)' }}>
                <div className="flex items-center" style={{ gap: 'var(--spacing-sm)' }}>
                  <WhatsAppIcon size={20} color="#a6e3a1" />
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>WhatsApp</span>
                </div>
                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-text)' }}>
                  {metrics.whatsappConversations}
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                background: 'var(--color-bg-secondary)',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${metrics.totalConversations > 0 ? (metrics.whatsappConversations / metrics.totalConversations) * 100 : 0}%`,
                  height: '100%',
                  background: '#a6e3a1',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: 'var(--spacing-sm)' }}>
                <div className="flex items-center" style={{ gap: 'var(--spacing-sm)' }}>
                  <InstagramIcon size={20} color="#f38ba8" />
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>Instagram</span>
                </div>
                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-text)' }}>
                  {metrics.instagramConversations}
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                background: 'var(--color-bg-secondary)',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${metrics.totalConversations > 0 ? (metrics.instagramConversations / metrics.totalConversations) * 100 : 0}%`,
                  height: '100%',
                  background: '#f38ba8',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* Actividad por día */}
        <div className="card">
          <h3 className="card-title flex items-center" style={{ gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
            <Calendar size={20} />
            Actividad (Últimos 7 días)
          </h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--spacing-xs)', height: '200px' }}>
            {metrics.conversationsByDay.map((day, index) => (
              <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                <div style={{
                  width: '100%',
                  background: 'var(--color-primary)',
                  borderRadius: '4px 4px 0 0',
                  height: `${(day.count / maxDayCount) * 180}px`,
                  minHeight: day.count > 0 ? '4px' : '0',
                  transition: 'height 0.3s ease',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingTop: 'var(--spacing-xs)'
                }}>
                  {day.count > 0 && (
                    <span style={{
                      color: 'var(--color-bg)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      marginBottom: '4px'
                    }}>
                      {day.count}
                    </span>
                  )}
                </div>
                <span style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                  textAlign: 'center',
                  writingMode: 'horizontal-tb'
                }}>
                  {day.date}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Conversaciones por agente */}
      {metrics.conversationsByAgent.length > 0 && (
        <div className="card" style={{ marginTop: 'var(--spacing-md)' }}>
          <h3 className="card-title flex items-center" style={{ gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
            <Users size={20} />
            Conversaciones por Agente
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

      {/* Estado de integraciones */}
      <div className="card" style={{ marginTop: 'var(--spacing-md)' }}>
          <h3 className="card-title flex items-center" style={{ gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
            <Zap size={20} />
            Estado del Sistema
          </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-md)' }}>
          <div style={{
            padding: 'var(--spacing-md)',
            background: 'var(--color-bg-secondary)',
            borderRadius: 'var(--border-radius)',
            border: `1px solid ${metrics.connectedIntegrations >= 2 ? 'var(--color-success)' : 'var(--color-border)'}`
          }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                Integraciones
              </span>
              <span style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 600,
                color: metrics.connectedIntegrations >= 2 ? 'var(--color-success)' : 'var(--color-text)'
              }}>
                {metrics.connectedIntegrations}/{integrations.length}
              </span>
            </div>
          </div>
          <div style={{
            padding: 'var(--spacing-md)',
            background: 'var(--color-bg-secondary)',
            borderRadius: 'var(--border-radius)',
            border: `1px solid ${metrics.activeAgents > 0 ? 'var(--color-success)' : 'var(--color-border)'}`
          }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                Agentes Activos
              </span>
              <span style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 600,
                color: metrics.activeAgents > 0 ? 'var(--color-success)' : 'var(--color-text)'
              }}>
                {metrics.activeAgents}
              </span>
            </div>
          </div>
          <div style={{
            padding: 'var(--spacing-md)',
            background: 'var(--color-bg-secondary)',
            borderRadius: 'var(--border-radius)',
            border: `1px solid ${metrics.totalConversations > 0 ? 'var(--color-success)' : 'var(--color-border)'}`
          }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                Conversaciones
              </span>
              <span style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 600,
                color: metrics.totalConversations > 0 ? 'var(--color-success)' : 'var(--color-text)'
              }}>
                {metrics.totalConversations}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Estado vacío */}
      {metrics.totalConversations === 0 && (
        <div className="card" style={{ marginTop: 'var(--spacing-md)' }}>
          <div className="empty-state">
            <BarChart3 size={48} style={{ margin: '0 auto var(--spacing-md)', opacity: 0.5 }} />
            <h3>No hay datos aún</h3>
            <p>Las analíticas aparecerán aquí una vez que tengas conversaciones activas</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default Analytics
