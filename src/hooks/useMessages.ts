import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { cacheService } from '../services/cache'

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

  const fetchMessages = async (useCache: boolean = true) => {
    if (!conversationId) {
      setMessages([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // Intentar obtener del caché primero
      const cacheKey = `messages-${conversationId}`
      if (useCache) {
        const cached = cacheService.get<Message[]>(cacheKey)
        if (cached) {
          console.log('📦 Using cached messages for conversation:', conversationId)
          setMessages(cached)
          setError(null)
          setLoading(false)
          // Cargar en background para actualizar
          fetchMessages(false).catch(() => {})
          return
        }
      }

      const { data, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (fetchError) throw fetchError

      const messagesData = data || []
      setMessages(messagesData)
      setError(null)

      // Guardar en caché (1 minuto - los mensajes cambian frecuentemente)
      cacheService.set(cacheKey, messagesData, 1 * 60 * 1000)
    } catch (err: any) {
      setError(err.message)
      console.error('Error fetching messages:', err)
    } finally {
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

      // Invalidar caché de conversaciones para reflejar el cambio
      cacheService.remove('conversations')
    } catch (err: any) {
      console.error('Error marking conversation as read:', err)
    }
  }

  useEffect(() => {
    // Resetear mensajes cuando cambia la conversación
    if (conversationId) {
      setMessages([])
      setError(null)
    }

    const checkAuthAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !conversationId) {
        setLoading(false)
        return
      }
      await fetchMessages()
      // Marcar como leído cuando se abre la conversación
      await markAsRead()
    }

    checkAuthAndFetch()

    if (!conversationId) return

    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel(`messages_changes_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          console.log('🔄 Realtime update en mensajes:', payload.eventType)

          if (payload.eventType === 'INSERT') {
            // Agregar nuevo mensaje sin recargar todo
            const newMessage = payload.new as Message
            setMessages(prev => {
              // Evitar duplicados
              if (prev.find(m => m.id === newMessage.id)) {
                return prev
              }
              // Agregar al final y ordenar por created_at
              const updated = [...prev, newMessage]
              return updated.sort((a, b) => {
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              })
            })
          } else if (payload.eventType === 'UPDATE') {
            // Actualizar mensaje existente
            const updatedMessage = payload.new as Message
            setMessages(prev => {
              const index = prev.findIndex(m => m.id === updatedMessage.id)
              if (index === -1) {
                // Si no existe, agregarlo
                const updated = [...prev, updatedMessage]
                return updated.sort((a, b) => {
                  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                })
              }
              // Actualizar
              const updated = [...prev]
              updated[index] = updatedMessage
              return updated
            })
          } else if (payload.eventType === 'DELETE') {
            // Eliminar mensaje
            const deletedId = payload.old.id
            setMessages(prev => prev.filter(m => m.id !== deletedId))
          }

          // Invalidar caché
          cacheService.remove(`messages-${conversationId}`)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Suscrito a cambios de mensajes en tiempo real para conversación:', conversationId)
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error en suscripción de mensajes')
        }
      })

    return () => {
      supabase.removeChannel(channel)
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
