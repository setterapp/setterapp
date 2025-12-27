import { useState, useEffect } from 'react'
import { useConversations } from '../hooks/useConversations'
import ConversationList from '../components/ConversationList'
import ChatPanel from '../components/ChatPanel'
import EmptyConversation from '../components/EmptyConversation'

function Conversations() {
  const { conversations, loading, error, markConversationRead } = useConversations()
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [selectedConversationNonce, setSelectedConversationNonce] = useState(0)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [isFirstSelection, setIsFirstSelection] = useState(true)

  // Detectar cambios de tamaño de ventana para responsive
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Limpiar selección si la conversación ya no existe
  useEffect(() => {
    if (selectedConversationId && conversations.length > 0) {
      const exists = conversations.some(c => c.id === selectedConversationId)
      if (!exists) {
        setSelectedConversationId(null)
      }
    }
  }, [conversations, selectedConversationId])

  // El refresh de sesión y recarga se manejan en useConversations
  // Solo necesitamos limpiar la selección si la conversación ya no existe

  // Manejar selección de conversación
  const handleSelectConversation = (id: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }

    // Si es la misma conversación, forzar refresh del panel (importante post-resume)
    if (id === selectedConversationId) {
      setSelectedConversationNonce((n) => n + 1)
      return
    }

    // IMPORTANTE: evitar setTimeout/requestAnimationFrame aquí.
    // En algunos browsers, después de volver del background, timers pueden quedar throttled
    // y el ID nunca se setea => ChatPanel no monta => no hay fetch de mensajes.
    setSelectedConversationId(id)
    setSelectedConversationNonce((n) => n + 1)
    // UI/DB: limpiar unread_count al abrir
    void markConversationRead(id)
    if (isFirstSelection) {
      setIsFirstSelection(false)
    }
    // Prevenir scroll de la página principal
    if (window.scrollY > 0) {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }

  // Encontrar la conversación seleccionada
  const selectedConversation = conversations.find((c) => c.id === selectedConversationId)

  // Manejar estados de carga y error
  if (loading && conversations.length === 0) {
    return (
      <div className="conversations-container">
        <div className="empty-state" style={{ width: '100%', padding: 'var(--spacing-2xl)' }}>
          <div className="spinner" />
          <p>Loading conversations...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="conversations-container">
        <div className="empty-state" style={{ width: '100%', padding: 'var(--spacing-2xl)' }}>
          <h3>Error</h3>
          <p style={{ color: 'var(--color-danger)' }}>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="conversations-container">
      <div className={`card conversations-card ${selectedConversationId ? 'conversations-card--expanded' : ''} ${isFirstSelection && selectedConversationId ? 'conversations-card--animating' : ''}`} style={{ border: '2px solid #000' }}>
        {/* Lista de conversaciones - ocultar en mobile cuando hay una seleccionada */}
        {(!isMobile || !selectedConversationId) && (
          <ConversationList
            conversations={conversations}
            selectedId={selectedConversationId}
            onSelect={handleSelectConversation}
          />
        )}

        {/* Panel de chat */}
        {selectedConversationId && selectedConversation && (
          <ChatPanel
            key={`${selectedConversationId}:${selectedConversationNonce}`}
            conversationId={selectedConversationId}
            conversation={selectedConversation}
            onBack={isMobile ? () => setSelectedConversationId(null) : undefined}
            isMobile={isMobile}
          />
        )}
      </div>

      {/* Estado vacío solo cuando no hay conversación seleccionada */}
      {!selectedConversationId && !isMobile && <EmptyConversation />}
    </div>
  )
}

export default Conversations
