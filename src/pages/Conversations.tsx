import { useState, useEffect } from 'react'
import { RefreshCcw } from 'lucide-react'
import { useConversations } from '../hooks/useConversations'
import { processAllConversationsWithoutLeadStatus } from '../services/ai/leadStatusDetection'
import ConversationList from '../components/ConversationList'
import ChatPanel from '../components/ChatPanel'
import EmptyConversation from '../components/EmptyConversation'

function Conversations() {
  const { conversations, loading, error, markConversationRead, refetch } = useConversations()
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [selectedConversationNonce, setSelectedConversationNonce] = useState(0)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [isFirstSelection, setIsFirstSelection] = useState(true)
  const [processingLeadStatus, setProcessingLeadStatus] = useState(false)

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
  const handleProcessLeadStatuses = async () => {
    setProcessingLeadStatus(true)
    try {
      const result = await processAllConversationsWithoutLeadStatus()
      if (result.success) {
        alert(`✅ ${result.message}`)
        // Refrescar las conversaciones para mostrar los nuevos estados
        refetch()
      } else {
        alert(`❌ Error: ${result.message}`)
      }
    } catch (error) {
      console.error('Error processing lead statuses:', error)
      alert('❌ Error al procesar estados de lead')
    } finally {
      setProcessingLeadStatus(false)
    }
  }

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

  // Contar conversaciones sin estado
  const conversationsWithoutStatus = conversations.filter(c => !c.lead_status).length

  return (
    <div className="conversations-container">
      {/* Header con botón para procesar estados de lead */}
      {conversationsWithoutStatus > 0 && (
        <div style={{
          marginBottom: 'var(--spacing-md)',
          padding: 'var(--spacing-md)',
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--border-radius)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h4 style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              🤖 Procesamiento de Leads
            </h4>
            <p style={{ margin: 'var(--spacing-xs) 0 0 0', fontSize: 'var(--font-size-sm)' }}>
              {conversationsWithoutStatus} conversación{conversationsWithoutStatus !== 1 ? 'es' : ''} sin estado de lead
            </p>
          </div>
          <button
            onClick={handleProcessLeadStatuses}
            disabled={processingLeadStatus}
            className="btn btn--primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              fontSize: 'var(--font-size-sm)'
            }}
          >
            <RefreshCcw
              size={16}
              style={processingLeadStatus ? {
                animation: 'spin 1s linear infinite',
                transformOrigin: 'center'
              } : {}}
            />
            {processingLeadStatus ? 'Procesando...' : 'Clasificar Leads'}
          </button>
        </div>
      )}

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
