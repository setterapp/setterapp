import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, User } from 'lucide-react'
import type { Conversation } from '../hooks/useConversations'
import { useMessages } from '../hooks/useMessages'
import MessageBubble from './MessageBubble'
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

  // Local state for optimistic lead status update
  const [optimisticLeadStatus, setOptimisticLeadStatus] = useState<'cold' | 'warm' | 'booked' | 'closed' | 'not_closed' | null>(
    conversation.contact_ref?.lead_status || null
  )

  // Sync with prop changes (e.g., when Realtime updates arrive)
  useEffect(() => {
    setOptimisticLeadStatus(conversation.contact_ref?.lead_status || null)
  }, [conversation.contact_ref?.lead_status])

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

  const getLeadStatusBackgroundColor = (status?: 'cold' | 'warm' | 'booked' | 'closed' | 'not_closed' | null) => {
    if (!status) return null
    switch (status) {
      case 'cold':
        return '#94a3b8' // secondary color
      case 'warm':
        return '#fbbf24' // warning color
      case 'booked':
        return '#ef4444' // danger color
      case 'closed':
        return '#22c55e' // success color
      case 'not_closed':
        return '#ef4444' // danger color
      default:
        return null
    }
  }

  const leadStatusBackgroundColor = getLeadStatusBackgroundColor(optimisticLeadStatus)

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
      : 'No name')

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          {isMobile && onBack && (
            <button
              onClick={onBack}
              className="btn-icon"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                color: 'var(--color-text)',
                flexShrink: 0,
              }}
            >
              <ArrowLeft size={20} />
            </button>
          )}
          {/* Avatar genérico del usuario */}
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '2px solid #000',
              background: 'var(--color-bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <User size={18} color="var(--color-text-secondary)" />
          </div>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 600, flexShrink: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </h3>
          {/* Selector de lead status - estilo badge como en Agentes */}
          <select
            value={optimisticLeadStatus || ''}
            onChange={async (e) => {
              const newStatus = e.target.value as 'cold' | 'warm' | 'booked' | 'closed' | 'not_closed' | ''
              if (!newStatus) return
              if (!conversation.contact_ref?.id) {
                console.error('No contact_ref to update lead status')
                return
              }

              // Optimistic update - update UI immediately
              setOptimisticLeadStatus(newStatus)

              try {
                // Only update contacts table (source of truth)
                await supabase
                  .from('contacts')
                  .update({
                    lead_status: newStatus,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', conversation.contact_ref.id)

                console.log('Lead status updated to:', newStatus)
              } catch (error) {
                console.error('Error updating lead status:', error)
                // Revert optimistic update on error
                setOptimisticLeadStatus(conversation.contact_ref?.lead_status || null)
              }
            }}
            style={{
              backgroundColor: leadStatusBackgroundColor || '#f3f4f6',
              color: '#000',
              padding: '4px 8px',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              border: '2px solid #000',
              cursor: 'pointer',
              marginLeft: 'auto',
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              appearance: 'none',
              backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23000\' stroke-width=\'3\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 6px center',
              backgroundSize: '12px',
              paddingRight: '24px',
            }}
          >
            <option value="">No status</option>
            <option value="cold">Cold</option>
            <option value="warm">Warm</option>
            <option value="booked">Booked</option>
            <option value="closed">Closed</option>
            <option value="not_closed">Not Closed</option>
          </select>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {loading && messages.length === 0 ? (
          <div className="empty-state">
            <div className="spinner" />
            <p>Loading messages...</p>
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
              Retry
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <p style={{ color: 'var(--color-text-secondary)' }}>
              No messages in this conversation
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
