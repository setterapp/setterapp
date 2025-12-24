import { useEffect, useRef } from 'react'
import { ArrowLeft, Pencil } from 'lucide-react'
import type { Conversation } from '../hooks/useConversations'
import { useMessages } from '../hooks/useMessages'
import MessageBubble from './MessageBubble'
import WhatsAppIcon from './icons/WhatsAppIcon'
import InstagramIcon from './icons/InstagramIcon'
import Badge from './common/Badge'
import { supabase } from '../lib/supabase'

interface ChatPanelProps {
  conversationId: string
  conversation: Conversation
  onBack?: () => void
  isMobile?: boolean
}

export default function ChatPanel({ conversationId, conversation, onBack, isMobile = false }: ChatPanelProps) {
  const { messages, loading, error, refetch } = useMessages(conversationId)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      const messagesContainer = messagesEndRef.current.closest('.messages-container')
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight
      }
    }
  }

  useEffect(() => {
    // Hacer scroll automático cuando hay nuevos mensajes
    if (messages.length > 0) {
      // Usar requestAnimationFrame para asegurar que el DOM se haya actualizado
      requestAnimationFrame(() => {
        setTimeout(() => {
          scrollToBottom()
        }, 50)
      })
    }
  }, [messages.length, messages])

  const PlatformIcon =
    conversation.platform === 'whatsapp'
      ? WhatsAppIcon
      : InstagramIcon

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

  const leadStatusVariant = getLeadStatusBadgeVariant(conversation.lead_status)
  const leadStatusLabel = getLeadStatusLabel(conversation.lead_status)

  const contact = conversation.contact_ref
  const alias = conversation.contact_alias
  const contactDisplayName = contact?.display_name
  const username = contact?.username || conversation.contact_metadata?.username
  const name = conversation.contact_metadata?.name
  const rawContact = conversation.contact || ''
  const isNumeric = /^\d+$/.test(rawContact)
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

  const subtitleParts: string[] = []
  if (username && !displayName.includes(`@${username}`)) {
    subtitleParts.push(`@${username}`)
  }
  if (conversation.platform === 'instagram' && (!username || username.trim() === '') && isNumeric) {
    subtitleParts.push(`ID …${rawContact.slice(-6)}`)
  }
  if (conversation.platform === 'whatsapp' && isNumeric) {
    subtitleParts.push(`+${rawContact}`)
  }

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          {isMobile && onBack && (
            <button
              onClick={onBack}
              className="btn-icon"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 'var(--spacing-xs)',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--color-text)',
              }}
            >
              <ArrowLeft size={24} />
            </button>
          )}
          {conversation.platform === 'instagram' ? (
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--border-radius-sm)',
                border: '2px solid #000',
                background: '#f38ba8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <InstagramIcon size={20} color="#000" />
            </div>
          ) : (
            <PlatformIcon size={28} />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>
                {displayName}
              </h3>
              <button
                onClick={async () => {
                  const next = window.prompt('Nombre para este contacto', (contact?.display_name || alias || name || username || rawContact) || '')
                  if (next === null) return
                  const trimmed = next.trim()
                  if (!trimmed) return
                  try {
                    if (contact?.id) {
                      await supabase
                        .from('contacts')
                        .update({ display_name: trimmed, updated_at: new Date().toISOString() })
                        .eq('id', contact.id)
                    } else {
                      await supabase
                        .from('conversations')
                        .update({ contact_alias: trimmed, updated_at: new Date().toISOString() })
                        .eq('id', conversationId)
                    }
                  } catch {
                    // sin logs
                  }
                }}
                className="btn-icon"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: 'var(--color-text-secondary)',
                }}
                title="Renombrar contacto"
                aria-label="Renombrar contacto"
              >
                <Pencil size={16} />
              </button>
            </div>
            {subtitleParts.length > 0 && (
              <div style={{ marginTop: 2, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                {subtitleParts.join(' · ')}
              </div>
            )}
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-xs)', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: conversation.platform === 'whatsapp'
                    ? '#a6e3a1'
                    : '#f38ba8',
                  fontWeight: 500,
                }}
              >
                {conversation.platform === 'whatsapp' ? 'WhatsApp' : 'Instagram'}
              </span>
              {leadStatusVariant && leadStatusLabel && (
                <Badge variant={leadStatusVariant}>
                  {leadStatusLabel}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {loading && messages.length === 0 ? (
          <div className="empty-state">
            <div className="spinner" />
            <p>Cargando mensajes...</p>
          </div>
        ) : error ? (
          <div className="empty-state">
            <p style={{ color: 'var(--color-danger)', marginBottom: 'var(--spacing-md)' }}>Error: {error}</p>
            <button
              onClick={() => refetch()}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--border-radius-sm)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 500,
              }}
            >
              Reintentar
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <p style={{ color: 'var(--color-text-secondary)' }}>
              No hay mensajes en esta conversación
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                platform={conversation.platform}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
    </div>
  )
}
