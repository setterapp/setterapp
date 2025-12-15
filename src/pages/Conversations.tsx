import { useState, useEffect } from 'react'
import { MessageSquare, MoreVertical } from 'lucide-react'
import { useConversations } from '../hooks/useConversations'
import ToggleSwitch from '../components/common/ToggleSwitch'
import { formatDate, formatFullDate } from '../utils/date'

function Conversations() {
  const { conversations, loading, error } = useConversations()
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null)
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [openMenuId])

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h2>Conversaciones</h2>
          <p>Gestiona y revisa todas tus conversaciones</p>
        </div>
        <div className="card">
          <div className="empty-state">
            <div className="spinner"></div>
            <p>Cargando conversaciones...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <div className="page-header">
          <h2>Conversaciones</h2>
          <p>Gestiona y revisa todas tus conversaciones</p>
        </div>
        <div className="card">
          <div className="empty-state">
            <h3>Error</h3>
            <p>{error}</p>
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
            <h2 className="flex items-center gap-md">
              <MessageSquare size={28} />
              Conversaciones
            </h2>
            <p>Gestiona y revisa todas tus conversaciones</p>
          </div>
        </div>
      </div>

      {conversations.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <MessageSquare size={48} style={{ margin: '0 auto var(--spacing-md)', opacity: 0.5 }} />
            <h3>No hay conversaciones</h3>
            <p>Las conversaciones aparecerán aquí una vez que conectes tus plataformas</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {conversations.map((conversation) => {
            const isActive = conversation.unread_count > 0

            return (
              <div
                key={conversation.id}
                className="conversation-card"
                style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--border-radius-lg)',
                  padding: 'var(--spacing-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-md)',
                  transition: 'var(--transition)',
                }}
              >
                {/* Top: Title and metadata */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                    <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-text)', flex: 1 }}>
                      {conversation.contact || 'Sin nombre'}
                    </h3>
                    {conversation.unread_count > 0 && (
                      <span
                        style={{
                          backgroundColor: 'var(--color-primary)',
                          color: 'var(--color-bg)',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          flexShrink: 0,
                        }}
                      >
                        {conversation.unread_count}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                    {conversation.last_message_at && (
                      <>Último mensaje {formatDate(conversation.last_message_at)}</>
                    )}
                    {conversation.created_at && conversation.last_message_at && ' | '}
                    {conversation.created_at && (
                      <>Creado {formatFullDate(conversation.created_at)}</>
                    )}
                  </p>
                  <div style={{ marginTop: 'var(--spacing-xs)', display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        backgroundColor: conversation.platform === 'whatsapp' ? 'rgba(166, 227, 161, 0.2)' : 'rgba(243, 139, 168, 0.2)',
                        color: conversation.platform === 'whatsapp' ? '#a6e3a1' : '#f38ba8',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        borderRadius: 'var(--border-radius-sm)',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 500,
                      }}
                    >
                      {conversation.platform === 'whatsapp' ? 'WhatsApp' : 'Instagram'}
                    </span>
                  </div>
                </div>

                {/* Bottom: Controls */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-md)', paddingTop: 'var(--spacing-sm)', borderTop: '1px solid var(--color-border)' }}>
                  {/* Active Label and Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flex: 1 }}>
                    {isActive && (
                      <span
                        style={{
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: 600,
                          color: 'var(--color-success)',
                        }}
                      >
                        Activo
                      </span>
                    )}
                    <ToggleSwitch
                      checked={isActive}
                      onChange={() => {}}
                      disabled
                    />
                  </div>

                  {/* Menu Icon */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenMenuId(openMenuId === conversation.id ? null : conversation.id)
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 'var(--spacing-xs)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-text)',
                      opacity: 0.7,
                      borderRadius: 'var(--border-radius-sm)',
                    }}
                  >
                    <MoreVertical size={20} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Conversations
