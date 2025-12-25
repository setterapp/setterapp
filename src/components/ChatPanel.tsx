import { useEffect, useRef } from 'react'
import { ArrowLeft, Pencil } from 'lucide-react'
import type { Conversation } from '../hooks/useConversations'
import { useMessages } from '../hooks/useMessages'
import MessageBubble from './MessageBubble'
import WhatsAppIcon from './icons/WhatsAppIcon'
import InstagramIcon from './icons/InstagramIcon'
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

  const getLeadStatusBackgroundColor = (status?: 'cold' | 'warm' | 'hot' | 'closed' | 'not_closed' | null) => {
    if (!status) return null
    switch (status) {
      case 'cold':
        return '#94a3b8' // secondary color
      case 'warm':
        return '#fbbf24' // warning color
      case 'hot':
        return '#ef4444' // danger color
      case 'closed':
        return '#22c55e' // success color
      case 'not_closed':
        return '#ef4444' // danger color
      default:
        return null
    }
  }

  const leadStatusBackgroundColor = getLeadStatusBackgroundColor(conversation.lead_status)

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
        {/* Primera fila: Ícono + Nombre + Editar + Lead Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', minHeight: '32px' }}>
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
          {conversation.platform === 'instagram' ? (
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--border-radius-sm)',
                border: '2px solid #000',
                background: '#f38ba8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <InstagramIcon size={18} color="#000" />
            </div>
          ) : (
            <div style={{ flexShrink: 0, display: 'flex' }}>
              <PlatformIcon size={24} />
            </div>
          )}
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 600, flexShrink: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
              flexShrink: 0,
            }}
            title="Renombrar contacto"
            aria-label="Renombrar contacto"
          >
            <Pencil size={14} />
          </button>
          {/* Selector de lead status - estilo badge como en Agentes */}
          <select
            value={conversation.lead_status || ''}
            onChange={async (e) => {
              const newStatus = e.target.value as 'cold' | 'warm' | 'hot' | 'closed' | 'not_closed' | ''
              if (!newStatus) return

              try {
                // Actualizar en conversations
                await supabase
                  .from('conversations')
                  .update({
                    lead_status: newStatus,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', conversationId)

                // Actualizar en contacts si existe
                if (conversation.contact_ref?.id) {
                  await supabase
                    .from('contacts')
                    .update({
                      lead_status: newStatus,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', conversation.contact_ref.id)
                }

                console.log('Lead status actualizado a:', newStatus)
              } catch (error) {
                console.error('Error actualizando lead status:', error)
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
            <option value="">Sin estado</option>
            <option value="cold">Frío</option>
            <option value="warm">Tibio</option>
            <option value="hot">Caliente</option>
            <option value="closed">Cerrado</option>
            <option value="not_closed">No Cerrado</option>
          </select>
        </div>

        {/* Segunda fila: Plataforma + Subtítulo (solo si hay subtítulo) */}
        {subtitleParts.length > 0 && (
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-xs)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginLeft: isMobile && onBack ? '44px' : '32px' }}>
            <span
              style={{
                color: conversation.platform === 'whatsapp' ? '#a6e3a1' : '#f38ba8',
                fontWeight: 500,
              }}
            >
              {conversation.platform === 'whatsapp' ? 'WhatsApp' : 'Instagram'}
            </span>
            <span>·</span>
            <span>{subtitleParts.join(' · ')}</span>
          </div>
        )}
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
