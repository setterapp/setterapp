import { useState, useEffect } from 'react'
import { useConversations } from '../hooks/useConversations'
import ConversationList from '../components/ConversationList'
import ChatPanel from '../components/ChatPanel'
import EmptyConversation from '../components/EmptyConversation'

function Conversations() {
  const { conversations, loading, error } = useConversations()
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  // Detectar cambios de tamaño de ventana para responsive
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Encontrar la conversación seleccionada
  const selectedConversation = conversations.find((c) => c.id === selectedConversationId)

  // Manejar estados de carga y error
  if (loading && conversations.length === 0) {
    return (
      <div className="conversations-container">
        <div className="empty-state" style={{ width: '100%', padding: 'var(--spacing-2xl)' }}>
          <div className="spinner" />
          <p>Cargando conversaciones...</p>
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
      {/* Lista de conversaciones - ocultar en mobile cuando hay una seleccionada */}
      {(!isMobile || !selectedConversationId) && (
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversationId}
          onSelect={setSelectedConversationId}
        />
      )}

      {/* Panel de chat o estado vacío */}
      {selectedConversationId && selectedConversation ? (
        <ChatPanel
          conversationId={selectedConversationId}
          conversation={selectedConversation}
          onBack={isMobile ? () => setSelectedConversationId(null) : undefined}
          isMobile={isMobile}
        />
      ) : (
        !isMobile && <EmptyConversation />
      )}
    </div>
  )
}

export default Conversations
