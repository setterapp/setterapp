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

  const fetchMessages = async (signal?: AbortSignal, useCache: boolean = true): Promise<void> => {
    if (!conversationId) {
      setMessages([])
      setLoading(false)
      return
    }

    try {
      // Intentar obtener del caché primero - ANTES de hacer la petición
      const cacheKey = `messages_${conversationId}`
      if (useCache && !signal?.aborted) {
        const cached = cacheService.get<Message[]>(cacheKey)
        if (cached) {
          console.log(`📦 Using cached messages for conversation ${conversationId} (instant)`)
          // Mostrar datos del caché inmediatamente
          setMessages(cached)
          setError(null)
          // Cargar en background para actualizar (sin mostrar loading)
          fetchMessages(signal, false).catch(() => {})
          return
        }
      }

      // Verificar sesión antes de hacer la petición
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        throw new Error('Sesión expirada. Por favor, recarga la página.')
      }

      // Verificar si la petición fue cancelada
      if (signal?.aborted) {
        return
      }

      // Timeout de 10 segundos (reducido para detectar problemas más rápido)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Timeout al cargar mensajes. Verifica tu conexión.'))
        }, 10000)
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

      // Verificar si la petición fue cancelada después de la race
      if (signal?.aborted) {
        return
      }

      if (fetchError) throw fetchError

      const messagesData = data || []
      setMessages(messagesData)
      // Guardar en caché (5 minutos)
      cacheService.set(cacheKey, messagesData, 5 * 60 * 1000)
      setError(null)
    } catch (err: any) {
      // Ignorar errores si la petición fue cancelada
      if (signal?.aborted || err.name === 'AbortError') {
        return
      }
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
    // AbortController para cancelar peticiones anteriores
    const abortController = new AbortController()
    const signal = abortController.signal

    // Si no hay conversationId, resetear estado y salir
    if (!conversationId) {
      setMessages([])
      setLoading(false)
      setError(null)
      return
    }

    // INMEDIATAMENTE resetear mensajes cuando cambia conversationId
    // NO poner loading todavía - primero intentar caché
    setMessages([])
    setError(null)

    // Intentar cargar desde caché primero
    const cacheKey = `messages_${conversationId}`
    const cached = cacheService.get<Message[]>(cacheKey)

    // Timeout de seguridad: forzar desactivación del loading después de 20 segundos máximo
    let loadingActive = true
    let safetyTimeout: NodeJS.Timeout | null = null

    // Fetch inicial
    const loadMessages = async () => {
      try {
        await fetchMessages(signal, false) // Sin caché porque ya lo verificamos arriba

        // Verificar si fue cancelado antes de marcar como leído
        if (!signal.aborted) {
          await markAsRead()
        }
      } catch (err) {
        // Ignorar errores si la petición fue cancelada
        if (signal.aborted || (err as any)?.name === 'AbortError') {
          return
        }
        console.error('Error loading messages:', err)
        setError(err instanceof Error ? err.message : 'Error cargando mensajes')
      } finally {
        // Asegurar que el loading se desactive después de intentar cargar
        if (!signal.aborted) {
          loadingActive = false
          if (safetyTimeout) {
            clearTimeout(safetyTimeout)
          }
          setLoading(false)
        }
      }
    }

    // Si hay caché, mostrarlo inmediatamente y cargar en background
    if (cached) {
      console.log(`📦 Using cached messages for conversation ${conversationId} (instant)`)
      setMessages(cached)
      setLoading(false)
      // Cargar en background para actualizar (sin mostrar loading)
      loadMessages().catch(() => {})
    } else {
      // Solo mostrar loading si no hay caché
      setLoading(true)

      // Configurar timeout de seguridad solo si no hay caché
      safetyTimeout = setTimeout(() => {
        if (loadingActive) {
          console.warn('⚠️ Timeout de seguridad: desactivando loading después de 20 segundos')
          setLoading(false)
          setError('La carga está tardando demasiado. Por favor, intenta nuevamente.')
          loadingActive = false
        }
      }, 20000)

      loadMessages()
    }

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

          // Verificar que no estemos ya cargando y que no esté cancelado
          if (!isCurrentlyLoading && !signal.aborted) {
            isCurrentlyLoading = true
            setLoading(true)
            setError(null)

            try {
              // Verificar sesión antes de recargar
              const { data: { session } } = await supabase.auth.getSession()
              if (session && !signal.aborted) {
                await fetchMessages(signal)
                if (!signal.aborted) {
                  await markAsRead()
                }
              } else {
                console.warn('⚠️ No hay sesión activa, no se pueden cargar mensajes')
                setError('Sesión expirada. Por favor, recarga la página.')
              }
            } catch (err: any) {
              // Ignorar errores si fue cancelado
              if (signal.aborted || err?.name === 'AbortError') {
                return
              }
              console.error('Error recargando mensajes después de AFK:', err)
              setError(err.message || 'Error al recargar mensajes')
            } finally {
              if (!signal.aborted) {
                setLoading(false)
              }
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
                  const sorted = updated.sort((a, b) => {
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                  })
                  // Actualizar caché
                  cacheService.set(`messages_${conversationId}`, sorted, 5 * 60 * 1000)
                  return sorted
                })
              } else if (payload.eventType === 'UPDATE') {
                // Actualizar mensaje existente
                const updatedMessage = payload.new as Message
                setMessages(prev => {
                  const index = prev.findIndex(m => m.id === updatedMessage.id)
                  let updated: Message[]
                  if (index === -1) {
                    // Si no existe, agregarlo
                    updated = [...prev, updatedMessage]
                  } else {
                    // Actualizar
                    updated = [...prev]
                    updated[index] = updatedMessage
                  }
                  const sorted = updated.sort((a, b) => {
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                  })
                  // Actualizar caché
                  cacheService.set(`messages_${conversationId}`, sorted, 5 * 60 * 1000)
                  return sorted
                })
              } else if (payload.eventType === 'DELETE') {
                // Eliminar mensaje
                const deletedId = payload.old.id
                setMessages(prev => {
                  const updated = prev.filter(m => m.id !== deletedId)
                  // Actualizar caché
                  cacheService.set(`messages_${conversationId}`, updated, 5 * 60 * 1000)
                  return updated
                })
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

    // Cleanup: cancelar petición si cambia conversationId o se desmonta el componente
    return () => {
      abortController.abort()
      if (safetyTimeout) {
        clearTimeout(safetyTimeout)
      }
      loadingActive = false
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

  const refetch = async () => {
    if (!conversationId) return

    setError(null)
    // Invalidar caché antes de refetch
    cacheService.remove(`messages_${conversationId}`)
    setLoading(true)

    try {
      await fetchMessages(undefined, false) // Forzar recarga sin caché
      await markAsRead()
    } catch (err) {
      console.error('Error en refetch:', err)
      setError(err instanceof Error ? err.message : 'Error al recargar mensajes')
    } finally {
      setLoading(false)
    }
  }

  return {
    messages,
    loading,
    error,
    refetch,
    markAsRead,
  }
}
