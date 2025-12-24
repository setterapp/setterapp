import { useState } from 'react'
import { MessageSquare, User } from 'lucide-react'
import type { Conversation } from '../hooks/useConversations'
import { formatDate } from '../utils/date'
import WhatsAppIcon from './icons/WhatsAppIcon'
import InstagramIcon from './icons/InstagramIcon'
import Badge from './common/Badge'

interface ConversationListProps {
  conversations: Conversation[]
  selectedId: string | null
  onSelect: (id: string, event?: React.MouseEvent) => void
}

export default function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  const getLeadStatusBadgeVariant = (status?: 'cold' | 'warm' | 'hot' | 'closed' | 'not_closed' | null) => {
    if (!status) return null
    switch (status) {
      case 'cold':
        return 'secondary'
      case 'warm':
        return 'warning'
      case 'hot':
        return 'danger'
      case 'closed':
        return 'success'
      case 'not_closed':
        return 'danger'
      default:
        return null
    }
  }

  const getLeadStatusLabel = (status?: 'cold' | 'warm' | 'hot' | 'closed' | 'not_closed' | null) => {
    if (!status) return null
    switch (status) {
      case 'cold':
        return 'Frío'
      case 'warm':
        return 'Tibio'
      case 'hot':
        return 'Caliente'
      case 'closed':
        return 'Cerrado'
      case 'not_closed':
        return 'No Cerrado'
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
            const PlatformIcon =
              conversation.platform === 'whatsapp'
                ? WhatsAppIcon
                : InstagramIcon
            const isSelected = conversation.id === selectedId
            const leadStatusVariant = getLeadStatusBadgeVariant(conversation.lead_status)
            const leadStatusLabel = getLeadStatusLabel(conversation.lead_status)

            return (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                PlatformIcon={PlatformIcon}
                isSelected={isSelected}
                leadStatusVariant={leadStatusVariant}
                leadStatusLabel={leadStatusLabel}
                onSelect={onSelect}
              />
            )
          })
        )}
      </div>
    </div>
  )
}

function ConversationItem({
  conversation,
  PlatformIcon,
  isSelected,
  leadStatusVariant,
  leadStatusLabel,
  onSelect,
}: {
  conversation: Conversation
  PlatformIcon: React.ComponentType<{ size?: number; color?: string }>
  isSelected: boolean
  leadStatusVariant: 'secondary' | 'warning' | 'danger' | 'success' | null
  leadStatusLabel: string | null
  onSelect: (id: string, event?: React.MouseEvent) => void
}) {
  const [imageError, setImageError] = useState(false)
  const contactPicture = conversation.contact_ref?.profile_picture
  const profilePicture = contactPicture || conversation.contact_metadata?.profile_picture
  const username = conversation.contact_ref?.username || conversation.contact_metadata?.username
  const name = conversation.contact_metadata?.name

  // Función para renderizar el avatar (foto o por defecto)
  const renderAvatar = () => {
    const hasProfilePicture = profilePicture && !imageError

    return (
      <div
        className="conversation-item-avatar"
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
          border: '3px solid var(--color-border)',
          background: hasProfilePicture
            ? 'transparent'
            : (conversation.platform === 'whatsapp'
                ? '#a6e3a1'
                : '#f38ba8'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {hasProfilePicture ? (
          <img
            src={profilePicture}
            alt={displayName}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onError={() => {
              setImageError(true)
            }}
          />
        ) : (
          // Avatar por defecto (monigote como WhatsApp)
          <User size={24} color="#666" />
        )}

        {/* Icono de red social debajo del avatar */}
        <div
          style={{
            position: 'absolute',
            bottom: '-8px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'white',
            borderRadius: '50%',
            padding: '2px',
            border: '2px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px',
          }}
        >
          <PlatformIcon size={12} color="#666" />
        </div>
      </div>
    )
  }

  const rawContact = conversation.contact || ''
  const isNumeric = /^\d+$/.test(rawContact)
  const alias = conversation.contact_alias
  const contactDisplayName = conversation.contact_ref?.display_name
  const displayName =
    contactDisplayName ||
    alias ||
    (username ? `@${username}` : null) ||
    name ||
    (rawContact
      ? (isNumeric
        ? (conversation.platform === 'whatsapp'
          ? `+${rawContact}`
          : `ID …${rawContact.slice(-6)}`)
        : rawContact)
      : 'Sin nombre')

  return (
    <div
      className={`conversation-item ${isSelected ? 'conversation-item--selected' : ''}`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onSelect(conversation.id, e)
      }}
      title={rawContact && displayName !== rawContact ? rawContact : undefined}
    >
      {/* Avatar con foto de perfil y icono de red social */}
      <div style={{ position: 'relative', paddingBottom: '12px' }}>
        {renderAvatar()}
      </div>

      <div className="conversation-item-content">
        <div className="conversation-item-header">
          <h4 className="conversation-item-name" style={{ fontWeight: conversation.unread_count > 0 ? 600 : 500 }}>
            {displayName}
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
            <Badge variant={leadStatusVariant}>
              {leadStatusLabel}
            </Badge>
          </div>
        )}
      </div>

      {conversation.unread_count > 0 && !isSelected && (
        <div className="conversation-item-badge">
          <span className="unread-badge">{conversation.unread_count}</span>
        </div>
      )}
    </div>
  )
}
