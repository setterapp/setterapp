import { useState, useEffect } from 'react'
import { useConversations } from '../hooks/useConversations'
import ConversationList from '../components/ConversationList'
import ChatPanel from '../components/ChatPanel'
import EmptyConversation from '../components/EmptyConversation'

function Conversations() {
  const { conversations, loading, error } = useConversations()
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
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
        console.log('⚠️ Conversación seleccionada ya no existe, limpiando selección')
        setSelectedConversationId(null)
      }
    }
  }, [conversations, selectedConversationId])

  // Detectar cuando vuelves de estar AFK y limpiar estados inconsistentes
  useEffect(() => {
    let hiddenTime: number | null = null

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenTime = Date.now()
      } else {
        // Si estuvo oculto más de 5 segundos, forzar reset de la selección para evitar estados inconsistentes
        if (hiddenTime && Date.now() - hiddenTime > 5000 && selectedConversationId) {
          console.log('🔄 Detectado retorno de AFK, reseteando selección de conversación')
          // Forzar un cambio de conversación para que se recargue todo
          const currentId = selectedConversationId
          setSelectedConversationId(null)
          // Restaurar después de un pequeño delay para forzar recarga completa
          setTimeout(() => {
            setSelectedConversationId(currentId)
          }, 100)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [selectedConversationId])

  // Manejar selección de conversación
  const handleSelectConversation = (id: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    
    // Si es la misma conversación, no hacer nada (evita recargas innecesarias)
    if (id === selectedConversationId) {
      return
    }
    
    // Forzar reset completo cambiando primero a null y luego al nuevo ID
    // Esto asegura que el hook useMessages se reinicie completamente
    setSelectedConversationId(null)
    
    // Usar requestAnimationFrame para asegurar que el DOM se actualice
    requestAnimationFrame(() => {
      setTimeout(() => {
        setSelectedConversationId(id)
        if (isFirstSelection) {
          setIsFirstSelection(false)
        }
        // Prevenir scroll de la página principal
        if (window.scrollY > 0) {
          window.scrollTo({ top: 0, behavior: 'instant' })
        }
      }, 50)
    })
  }

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
      <div className={`card conversations-card ${selectedConversationId ? 'conversations-card--expanded' : ''} ${isFirstSelection && selectedConversationId ? 'conversations-card--animating' : ''}`}>
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
