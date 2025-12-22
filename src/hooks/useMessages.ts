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

  const fetchMessages = async (): Promise<void> => {
    if (!conversationId) {
      setMessages([])
      setLoading(false)
      return
    }

    try {
      // Verificar sesión antes de hacer la petición
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        throw new Error('Sesión expirada. Por favor, recarga la página.')
      }

      // Timeout de 15 segundos (aumentado para conexiones lentas)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Timeout al cargar mensajes. Verifica tu conexión.'))
        }, 15000)
      })

      const fetchPromise = supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      const { data, error: fetchError } = await Promise.race([
        fetchPromise,
        timeoutPromise
      ]) as { data: Message[] | null; error: any }

      if (fetchError) throw fetchError

      setMessages(data || [])
      setError(null)
    } catch (err: any) {
      console.error('Error fetching messages:', err)
      setError(err.message || 'Error cargando mensajes')
      setMessages([])
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

    // Fetch inicial
    const loadMessages = async () => {
      try {
        await fetchMessages()
        await markAsRead()
      } catch (err) {
        console.error('Error loading messages:', err)
      } finally {
        // Asegurar que el loading se desactive después de intentar cargar
        setLoading(false)
      }
    }

    loadMessages()

    // Detectar AFK y forzar recarga de mensajes cuando vuelves (sin recargar página)
    let hiddenTime: number | null = null
    let isCurrentlyLoading = false

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // Guardar cuando se oculta
        hiddenTime = Date.now()
      } else {
        // Cuando vuelve visible después de estar oculto
        if (hiddenTime && Date.now() - hiddenTime > 5000) {
          // Estuvo oculto más de 5 segundos - recargar mensajes
          console.log('🔄 Recargando mensajes después de AFK')
          
          // Verificar que no estemos ya cargando
          if (!isCurrentlyLoading) {
            isCurrentlyLoading = true
            setLoading(true)
            setError(null)
            
            try {
              // Verificar sesión antes de recargar
              const { data: { session } } = await supabase.auth.getSession()
              if (session) {
                await fetchMessages()
                await markAsRead()
              } else {
                console.warn('⚠️ No hay sesión activa, no se pueden cargar mensajes')
                setError('Sesión expirada. Por favor, recarga la página.')
              }
            } catch (err: any) {
              console.error('Error recargando mensajes después de AFK:', err)
              setError(err.message || 'Error al recargar mensajes')
            } finally {
              setLoading(false)
              isCurrentlyLoading = false
            }
          }
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Suscribirse a cambios en tiempo real (no bloquea el fetch)
    let channel: ReturnType<typeof supabase.channel> | null = null

    const setupRealtime = async () => {
      // Limpiar canal anterior si existe
      if (channel) {
        try {
          await supabase.removeChannel(channel)
        } catch (error) {
          console.error('Error removing previous channel:', error)
        }
      }

      try {
        channel = supabase
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
              console.error('❌ Error en suscripción de mensajes')
              // Intentar reconectar después de un delay
              setTimeout(() => {
                setupRealtime()
              }, 2000)
            } else if (status === 'TIMED_OUT') {
              console.warn('⚠️ Timeout en suscripción de mensajes, reintentando...')
              setTimeout(() => {
                setupRealtime()
              }, 2000)
            } else if (status === 'CLOSED') {
              console.log('ℹ️ Canal de mensajes cerrado')
            }
          })
      } catch (error) {
        console.error('❌ Error creando canal de mensajes:', error)
        // Reintentar después de un delay
        setTimeout(() => {
          setupRealtime()
        }, 2000)
      }
    }

    setupRealtime()

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
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
