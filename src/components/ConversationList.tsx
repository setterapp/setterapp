import { MessageSquare } from 'lucide-react'
import type { Conversation } from '../hooks/useConversations'
import { formatDate } from '../utils/date'
import WhatsAppIcon from './icons/WhatsAppIcon'
import InstagramIcon from './icons/InstagramIcon'
import Badge from './common/Badge'

interface ConversationListProps {
  conversations: Conversation[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  const getLeadStatusBadgeVariant = (status?: 'cold' | 'warm' | 'hot' | null) => {
    if (!status) return null
    switch (status) {
      case 'cold':
        return 'secondary'
      case 'warm':
        return 'warning'
      case 'hot':
        return 'danger'
      default:
        return null
    }
  }

  const getLeadStatusLabel = (status?: 'cold' | 'warm' | 'hot' | null) => {
    if (!status) return null
    switch (status) {
      case 'cold':
        return 'Frío'
      case 'warm':
        return 'Tibio'
      case 'hot':
        return 'Caliente'
      default:
        return null
    }
  }

  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <MessageSquare size={24} />
          Conversaciones
        </h3>
      </div>

      <div className="conversation-list-items">
        {conversations.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--spacing-xl)' }}>
            <MessageSquare size={48} style={{ margin: '0 auto var(--spacing-md)', opacity: 0.3 }} />
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              No hay conversaciones
            </p>
          </div>
        ) : (
          conversations.map((conversation) => {
            const PlatformIcon = conversation.platform === 'whatsapp' ? WhatsAppIcon : InstagramIcon
            const isSelected = conversation.id === selectedId
            const leadStatusVariant = getLeadStatusBadgeVariant(conversation.lead_status)
            const leadStatusLabel = getLeadStatusLabel(conversation.lead_status)

            return (
              <div
                key={conversation.id}
                className={`conversation-item ${isSelected ? 'conversation-item--selected' : ''}`}
                onClick={() => onSelect(conversation.id)}
              >
                <div
                  className="conversation-item-icon"
                  style={{
                    background: conversation.platform === 'whatsapp' ? '#a6e3a1' : '#f38ba8'
                  }}
                >
                  <PlatformIcon size={20} color="#000" />
                </div>

                <div className="conversation-item-content">
                  <div className="conversation-item-header">
                    <h4 className="conversation-item-name" style={{ fontWeight: conversation.unread_count > 0 ? 600 : 500 }}>
                      {conversation.contact || 'Sin nombre'}
                    </h4>
                    <p className="conversation-item-timestamp">
                      {conversation.last_message_at
                        ? formatDate(conversation.last_message_at)
                        : formatDate(conversation.created_at)}
                    </p>
                  </div>
                  <p className="conversation-item-message">
                    Último mensaje de la conversación...
                  </p>
                  {leadStatusVariant && leadStatusLabel && (
                    <div style={{ marginTop: 'var(--spacing-xs)' }}>
                      <Badge variant={leadStatusVariant as any}>
                        {leadStatusLabel}
                      </Badge>
                    </div>
                  )}
                </div>

                {conversation.unread_count > 0 && (
                  <div className="conversation-item-badge">
                    <span className="unread-badge">{conversation.unread_count}</span>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
