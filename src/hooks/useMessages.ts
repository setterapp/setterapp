import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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

  const fetchMessages = async () => {
    if (!conversationId) {
      setMessages([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (fetchError) throw fetchError
      setMessages(data || [])
    } catch (err: any) {
      console.error('Error fetching messages:', err)
      setError(err.message || 'Error cargando mensajes')
      setMessages([])
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

    let channel: ReturnType<typeof supabase.channel> | null = null

    try {
      channel = supabase
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
        .subscribe()
    } catch (error) {
      console.error('Error creando canal de mensajes:', error)
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel)
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
