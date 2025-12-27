import { useState } from 'react'
import { MessageSquare, User } from 'lucide-react'
import type { Conversation } from '../hooks/useConversations'
import { formatDate } from '../utils/date'
import WhatsAppIcon from './icons/WhatsAppIcon'
import InstagramIcon from './icons/InstagramIcon'
import LeadStatusBadge from './badges/LeadStatusBadge'

interface ConversationListProps {
  conversations: Conversation[]
  selectedId: string | null
  onSelect: (id: string, event?: React.MouseEvent) => void
}

export default function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  return (
    <div className="conversation-list">
      <div className="conversation-list-header">
        <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <MessageSquare size={24} />
          Conversations
        </h3>
      </div>

      <div className="conversation-list-items">
        {conversations.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--spacing-xl)' }}>
            <MessageSquare size={48} style={{ margin: '0 auto var(--spacing-md)', opacity: 0.3 }} />
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              No conversations
            </p>
          </div>
        ) : (
          conversations.map((conversation) => {
            const PlatformIcon =
              conversation.platform === 'whatsapp'
                ? WhatsAppIcon
                : InstagramIcon
            const isSelected = conversation.id === selectedId

            return (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                PlatformIcon={PlatformIcon}
                isSelected={isSelected}
                leadStatusVariant={null}
                leadStatusLabel={null}
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
  onSelect,
}: {
  conversation: Conversation
  PlatformIcon: React.ComponentType<{ size?: number; color?: string }>
  isSelected: boolean
  onSelect: (id: string, event?: React.MouseEvent) => void
  leadStatusVariant?: any
  leadStatusLabel?: any
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
      <div style={{ position: 'relative', width: '48px', height: '48px' }}>
        {/* Avatar circular */}
        <div
          className="conversation-item-avatar"
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            border: '3px solid var(--color-border)',
            background: hasProfilePicture ? 'transparent' : 'var(--color-bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
            <User size={24} color="var(--color-text-secondary)" />
          )}
        </div>

        {/* Icono de red social abajo a la izquierda */}
        <div
          style={{
            position: 'absolute',
            bottom: '-2px',
            left: '-2px',
            background: conversation.platform === 'whatsapp' ? '#a6e3a1' : '#f38ba8',
            borderRadius: '50%',
            padding: '4px',
            border: '2px solid #000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        >
          <PlatformIcon size={16} color="#000" />
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
      : 'No name')

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
      {renderAvatar()}

      <div className="conversation-item-content">
        <div className="conversation-item-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', width: '100%' }}>
            <h4 className="conversation-item-name" style={{ fontWeight: conversation.unread_count > 0 ? 600 : 500, margin: 0, flex: 1 }}>
              {displayName}
            </h4>
            {conversation.contact_ref?.lead_status && (
              <LeadStatusBadge status={conversation.contact_ref.lead_status} />
            )}
          </div>
          <p className="conversation-item-timestamp" style={{ marginTop: 'var(--spacing-xs)' }}>
            {conversation.last_message_at
              ? formatDate(conversation.last_message_at)
              : formatDate(conversation.created_at)}
          </p>
        </div>
        <p className="conversation-item-message">
          Last message in conversation...
        </p>
      </div>

      {conversation.unread_count > 0 && !isSelected && (
        <div className="conversation-item-badge">
          <span className="unread-badge">{conversation.unread_count}</span>
        </div>
      )}
    </div>
  )
}
