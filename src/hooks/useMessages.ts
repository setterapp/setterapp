import { useState, useEffect, useRef } from 'react'
import { supabase, resetSupabaseClient } from '../lib/supabase'

export interface Message {
  id: string
  conversation_id: string
  user_id: string
  platform_message_id: string
  content: string
  direction: 'inbound' | 'outbound'
  message_type: 'text' | 'image' | 'audio' | 'video'
  metadata: {
    sender_id?: string
    recipient_id?: string
    timestamp?: number
    [key: string]: any
  }
  created_at: string
}

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const isIntentionalCloseRef = useRef(false)
  const activeFetchIdRef = useRef(0)

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = 12000): Promise<T> => {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)),
    ])
  }

  const fetchMessages = async () => {
    if (!conversationId) {
      setMessages([])
      setLoading(false)
      return
    }

    const fetchId = ++activeFetchIdRef.current
    try {
      setLoading(true)
      setError(null)

      const runQuery = async () => {
        return await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
      }

      let result = await withTimeout(runQuery(), 12000).catch(async (e) => {
        console.warn('⚠️ fetchMessages colgado/falló. Reseteando Supabase y reintentando...', e)
        await resetSupabaseClient('fetchMessages')
        return await withTimeout(runQuery(), 12000)
      })

      const { data, error: fetchError } = result
      if (fetchError) throw fetchError
      if (fetchId !== activeFetchIdRef.current) return
      setMessages(data || [])
    } catch (err: any) {
      console.error('Error fetching messages:', err)
      if (fetchId !== activeFetchIdRef.current) return
      setError(err?.message || 'Error cargando mensajes')
      setMessages([])
    } finally {
      if (fetchId !== activeFetchIdRef.current) return
      setLoading(false)
    }
  }

  const markAsRead = async () => {
    if (!conversationId) return

    try {
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId)

      if (updateError) throw updateError
    } catch (err: any) {
      console.error('Error marking conversation as read:', err)
    }
  }

  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      setLoading(false)
      setError(null)
      return
    }

    fetchMessages()
    markAsRead()

    const subscribeToMessages = () => {
      // Si ya existe un canal, lo limpiamos antes de crear uno nuevo
      if (channelRef.current) {
        try {
          isIntentionalCloseRef.current = true
          supabase.removeChannel(channelRef.current)
          channelRef.current = null
        } catch (error) {
          console.error('Error removiendo canal anterior:', error)
        }
      }

      try {
        const channel = supabase
          .channel(`messages_changes_${conversationId}_${Date.now()}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=eq.${conversationId}`
            },
            (payload) => {
              if (payload.eventType === 'INSERT') {
                const newMessage = payload.new as Message
                setMessages(prev => {
                  if (prev.find(m => m.id === newMessage.id)) return prev
                  const updated = [...prev, newMessage]
                  return updated.sort((a, b) => {
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                  })
                })
              } else if (payload.eventType === 'UPDATE') {
                const updatedMessage = payload.new as Message
                setMessages(prev => {
                  const index = prev.findIndex(m => m.id === updatedMessage.id)
                  if (index === -1) {
                    const updated = [...prev, updatedMessage]
                    return updated.sort((a, b) => {
                      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    })
                  }
                  const updated = [...prev]
                  updated[index] = updatedMessage
                  return updated
                })
              } else if (payload.eventType === 'DELETE') {
                const deletedId = payload.old.id
                setMessages(prev => prev.filter(m => m.id !== deletedId))
              }
            }
          )
          .subscribe(async (status) => {
            console.log(`📡 Estado del canal de mensajes: ${status}`)

            if (status === 'SUBSCRIBED') {
              console.log('✅ Canal de mensajes conectado con éxito')
              isIntentionalCloseRef.current = false
            }

            if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              // Solo reconectar si NO fue un cierre intencional
              if (!isIntentionalCloseRef.current) {
                console.warn('⚠️ Conexión de mensajes perdida. Intentando reconectar en 2s...')
                setTimeout(() => subscribeToMessages(), 2000)
              } else {
                console.log('🔌 Canal de mensajes cerrado intencionalmente')
              }
            }

            if (status === 'TIMED_OUT') {
              console.warn('⏱️ Timeout en canal de mensajes. Reintentando...')
              setTimeout(() => subscribeToMessages(), 2000)
            }
          })

        channelRef.current = channel
      } catch (error) {
        console.error('❌ Error creando canal de mensajes:', error)
        // Reintentar después de un delay
        setTimeout(() => subscribeToMessages(), 2000)
      }
    }

    subscribeToMessages()

    const handleResume = async () => {
      // En resume, hacemos refetch + resubscribe
      await fetchMessages()
      markAsRead()
      subscribeToMessages()
    }

    window.addEventListener('appsetter:supabase-resume', handleResume as EventListener)

    return () => {
      window.removeEventListener('appsetter:supabase-resume', handleResume as EventListener)
      if (channelRef.current) {
        try {
          isIntentionalCloseRef.current = true
          supabase.removeChannel(channelRef.current)
        } catch (error) {
          console.error('Error removing channel:', error)
        }
      }
    }
  }, [conversationId])

  return {
    messages,
    loading,
    error,
    refetch: fetchMessages,
    markAsRead,
  }
}
