import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
// Clasificación automática de lead status removida - ahora es manual

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

// Caché a nivel de módulo por conversación
const cachedMessages: Map<string, Message[]> = new Map()

export function useMessages(conversationId: string | null) {
  const cached = conversationId ? cachedMessages.get(conversationId) : undefined
  const [messages, setMessages] = useState<Message[]>(cached || [])
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const isIntentionalCloseRef = useRef(false)
  const fetchAbortRef = useRef<AbortController | null>(null)
  const activeFetchIdRef = useRef(0)
  const channelKeyRef = useRef<string | null>(null)

  const fetchMessages = async () => {
    if (!conversationId) {
      setMessages([])
      setLoading(false)
      return
    }

    const fetchId = ++activeFetchIdRef.current
    if (fetchAbortRef.current) fetchAbortRef.current.abort()
    const controller = new AbortController()
    fetchAbortRef.current = controller
    const timeoutId = window.setTimeout(() => controller.abort(), 12000)
    try {
      // Solo mostrar loading si NO hay caché para esta conversación
      const cached = cachedMessages.get(conversationId)
      if (!cached) {
        setLoading(true)
      }
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .abortSignal(controller.signal)
      if (fetchError) throw fetchError
      if (fetchId !== activeFetchIdRef.current) return

      // Actualizar estado y caché
      const newData = data || []
      cachedMessages.set(conversationId, newData)
      setMessages(newData)
    } catch (err: any) {
      if (fetchId !== activeFetchIdRef.current) return
      const msg = err?.name === 'AbortError'
        ? 'Timeout loading messages'
        : (err?.message || 'Error loading messages')
      setError(msg)
      setMessages([])
    } finally {
      window.clearTimeout(timeoutId)
      if (fetchId === activeFetchIdRef.current) {
        setLoading(false)
      }
      if (fetchAbortRef.current === controller) {
        fetchAbortRef.current = null
      }
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
      // Sin logs en producción por seguridad
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
      const channelKey = `messages_changes_${conversationId}`
      if (channelRef.current && channelKeyRef.current === channelKey) {
        return
      }

      // Si ya existe un canal, lo limpiamos antes de crear uno nuevo
      if (channelRef.current) {
        try {
          isIntentionalCloseRef.current = true
          supabase.removeChannel(channelRef.current)
          channelRef.current = null
        } catch (error) {
          // Sin logs en producción por seguridad
        }
      }

      try {
        const channel = supabase
          .channel(channelKey)
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
                  const sorted = updated.sort((a, b) => {
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                  })
                  if (conversationId) cachedMessages.set(conversationId, sorted)
                  return sorted
                })

                // Clasificación automática de lead status removida - ahora es manual por el usuario
              } else if (payload.eventType === 'UPDATE') {
                const updatedMessage = payload.new as Message
                setMessages(prev => {
                  const index = prev.findIndex(m => m.id === updatedMessage.id)
                  let updated: Message[]
                  if (index === -1) {
                    updated = [...prev, updatedMessage].sort((a, b) => {
                      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    })
                  } else {
                    updated = [...prev]
                    updated[index] = updatedMessage
                  }
                  if (conversationId) cachedMessages.set(conversationId, updated)
                  return updated
                })
              } else if (payload.eventType === 'DELETE') {
                const deletedId = payload.old.id
                setMessages(prev => {
                  const updated = prev.filter(m => m.id !== deletedId)
                  if (conversationId) cachedMessages.set(conversationId, updated)
                  return updated
                })
              }
            }
          )
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              isIntentionalCloseRef.current = false
            }

            if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              // Solo reconectar si NO fue un cierre intencional
              if (!isIntentionalCloseRef.current) {
                setTimeout(() => subscribeToMessages(), 2000)
              } else {
              }
            }

            if (status === 'TIMED_OUT') {
              setTimeout(() => subscribeToMessages(), 2000)
            }
          })

        channelRef.current = channel
        channelKeyRef.current = channelKey
      } catch (error) {
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
          // Sin logs en producción por seguridad
        }
      }
      channelRef.current = null
      channelKeyRef.current = null
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
