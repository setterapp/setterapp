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

      // Timeout de 10 segundos
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout al cargar mensajes')), 10000)
      )

      const fetchPromise = supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      const { data, error: fetchError } = await Promise.race([fetchPromise, timeoutPromise]) as any

      if (fetchError) throw fetchError

      setMessages(data || [])
      setError(null)
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
    // Si no hay conversationId, resetear estado y salir
    if (!conversationId) {
      setMessages([])
      setLoading(false)
      setError(null)
      return
    }

    // INMEDIATAMENTE resetear mensajes y poner loading cuando cambia conversationId
    setLoading(true)
    setMessages([])
    setError(null)

    const loadMessages = async () => {
      try {
        // Verificar sesión con timeout
        const sessionTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout verificando sesión')), 5000)
        )

        const sessionPromise = supabase.auth.getSession()

        const { data: { session }, error: sessionError } = await Promise.race([
          sessionPromise,
          sessionTimeout
        ]) as any

        if (sessionError || !session) {
          console.error('Sin sesión válida:', sessionError)
          setLoading(false)
          setError('Sesión expirada. Recarga la página.')
          return
        }

        // Fetch directo sin caché
        await fetchMessages()
        // Marcar como leído
        await markAsRead()
      } catch (error) {
        console.error('Error loading messages:', error)
        setLoading(false)
        setError('Error cargando mensajes. Recarga la página.')
      }
    }

    loadMessages()

    // Suscribirse a cambios en tiempo real (no bloquea el fetch)
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
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Suscrito a cambios de mensajes en tiempo real para conversación:', conversationId)
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Error en suscripción de mensajes (no afecta carga inicial)')
          }
        })
    } catch (error) {
      console.error('❌ Error creando canal de mensajes (no afecta carga inicial):', error)
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
