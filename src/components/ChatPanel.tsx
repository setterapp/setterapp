import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Send } from 'lucide-react'
import type { Conversation } from '../hooks/useConversations'
import { useMessages } from '../hooks/useMessages'
import MessageBubble from './MessageBubble'
import WhatsAppIcon from './icons/WhatsAppIcon'
import InstagramIcon from './icons/InstagramIcon'
import Badge from './common/Badge'

interface ChatPanelProps {
  conversationId: string
  conversation: Conversation
  onBack?: () => void
  isMobile?: boolean
}

export default function ChatPanel({ conversationId, conversation, onBack, isMobile = false }: ChatPanelProps) {
  const { messages, loading, error } = useMessages(conversationId)
  const [input, setInput] = useState('')
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
    // Solo hacer scroll si hay mensajes y no es el primer render
    if (messages.length > 0) {
      // Usar setTimeout para asegurar que el DOM se haya actualizado
      setTimeout(() => {
        scrollToBottom()
      }, 100)
    }
  }, [messages])

  const PlatformIcon = conversation.platform === 'whatsapp' ? WhatsAppIcon : InstagramIcon

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

  const leadStatusVariant = getLeadStatusBadgeVariant(conversation.lead_status)
  const leadStatusLabel = getLeadStatusLabel(conversation.lead_status)

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
          <PlatformIcon size={28} />
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>
              {conversation.contact || 'Sin nombre'}
            </h3>
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-xs)', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: conversation.platform === 'whatsapp' ? '#a6e3a1' : '#f38ba8',
                  fontWeight: 500,
                }}
              >
                {conversation.platform === 'whatsapp' ? 'WhatsApp' : 'Instagram'}
              </span>
              {leadStatusVariant && leadStatusLabel && (
                <Badge variant={leadStatusVariant as any}>
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
            <p style={{ color: 'var(--color-danger)' }}>Error: {error}</p>
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
                contact={conversation.contact}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="message-input-container">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Próximamente: responder mensajes"
          disabled
          className="input"
          style={{
            flex: 1,
            cursor: 'not-allowed',
            opacity: 0.6,
          }}
        />
        <button
          type="button"
          disabled
          className="btn btn--primary"
          style={{
            minWidth: 'auto',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            cursor: 'not-allowed',
            opacity: 0.6,
          }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}
