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
        () => {
          // Invalidar caché y recargar
          cacheService.remove(`messages-${conversationId}`)
          fetchMessages(false)
        }
      )
      .subscribe()

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
