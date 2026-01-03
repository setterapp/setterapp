import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import type { Agent } from '../hooks/useAgents'
import { supabase } from '../lib/supabase'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AgentTestChatProps {
  agent: Agent
  onClose: () => void
}

export default function AgentTestChat({ agent }: AgentTestChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Agregar mensaje de bienvenida si hay pregunta de apertura
  useEffect(() => {
    if (agent.config?.openingQuestion && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: agent.config.openingQuestion
      }])
    }
  }, [agent.config?.openingQuestion, messages.length])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      // Call the test-agent edge function (no message credits counted, no DB saves)
      const { data, error: invokeError } = await supabase.functions.invoke('test-agent', {
        body: {
          agent_name: agent.name,
          description: agent.description,
          user_message: userMessage.content,
          conversation_history: messages,
          config: agent.config
        }
      })

      if (invokeError) {
        throw new Error(invokeError.message || 'Error calling test-agent')
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.content || 'No response'
      }])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error generating response'
      console.error('Error generating response:', err)
      setError(message)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${message}`
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '600px', width: '100%' }}>
      {/* Header */}
      <div style={{
        padding: 'var(--spacing-lg)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--color-bg)'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>
            Probando: {agent.name}
          </h3>
          <p style={{ margin: 'var(--spacing-xs) 0 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {agent.description}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'var(--spacing-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md)',
        background: 'var(--color-bg-secondary)'
      }}>
        {messages.length === 0 && !agent.config?.openingQuestion && (
          <div style={{
            textAlign: 'center',
            color: 'var(--color-text-secondary)',
            padding: 'var(--spacing-xl)'
          }}>
            <p>Escribe un mensaje para comenzar a probar el agente</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
              width: '100%'
            }}
          >
            <div
              style={{
                maxWidth: '75%',
                padding: 'var(--spacing-md)',
                borderRadius: 'var(--border-radius)',
                background: message.role === 'user'
                  ? 'var(--color-primary)'
                  : 'var(--color-bg)',
                color: message.role === 'user' ? 'var(--color-bg)' : 'var(--color-text)',
                border: message.role === 'assistant' ? '1px solid var(--color-border)' : 'none',
                fontSize: 'var(--font-size-sm)',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {message.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: 'var(--spacing-md)',
              borderRadius: 'var(--border-radius)',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)'
            }}>
              <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                Pensando...
              </span>
            </div>
          </div>
        )}

        {error && (
          <div style={{
            padding: 'var(--spacing-sm)',
            background: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--color-danger)',
            borderRadius: 'var(--border-radius-sm)',
            fontSize: 'var(--font-size-xs)'
          }}>
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{
        padding: 'var(--spacing-lg)',
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-bg)',
        display: 'flex',
        gap: 'var(--spacing-sm)'
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe un mensaje..."
          disabled={loading}
          className="input"
          style={{ flex: 1 }}
          autoFocus
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="btn btn--primary"
          style={{ minWidth: 'auto', padding: 'var(--spacing-sm) var(--spacing-md)' }}
        >
          {loading ? (
            <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
          ) : (
            <Send size={18} />
          )}
        </button>
      </form>
    </div>
  )
}
