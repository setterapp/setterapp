import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { cacheService } from '../services/cache'
import { setupSessionRefresh } from '../lib/supabase'

export interface Conversation {
  id: string
  contact: string
  platform: 'whatsapp' | 'instagram'
  agent_id?: string | null
  unread_count: number
  last_message_at?: string
  created_at: string
  updated_at: string
  lead_status?: 'cold' | 'warm' | 'hot' | null
  contact_metadata?: {
    username?: string
    name?: string
    profile_picture?: string
  }
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConversations = async (useCache: boolean = true, forceRefresh: boolean = false) => {
    try {
      // Si se fuerza refresh, invalidar caché primero
      if (forceRefresh) {
        cacheService.remove('conversations')
        useCache = false
      }

      // Intentar obtener del caché primero - ANTES de poner loading
      const cacheKey = 'conversations'
      if (useCache) {
        const cached = cacheService.get<Conversation[]>(cacheKey)
        if (cached) {
          console.log('📦 Using cached conversations (instant)')
          // Mostrar datos del caché inmediatamente sin loading
          setConversations(cached)
          setError(null)
          setLoading(false)
          // Cargar en background para actualizar (sin mostrar loading)
          fetchConversations(false, false).catch(() => {})
          return
        }
      }

      // Solo mostrar loading si no hay caché
      setLoading(true)

      // Verificar y refrescar sesión PRIMERO
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          try {
            await supabase.auth.refreshSession()
          } catch (refreshErr) {
            console.warn('No se pudo refrescar sesión, continuando:', refreshErr)
          }
        } else {
          // Si no hay sesión, intentar usar caché como fallback
          const cached = cacheService.get<Conversation[]>(cacheKey)
          if (cached) {
            console.log('📦 Usando caché como fallback (sesión no disponible)')
            setConversations(cached)
            setError(null)
            setLoading(false)
            return
          }
          throw new Error('No hay sesión activa')
        }
      } catch (sessionErr: any) {
        console.error('Error con sesión:', sessionErr)
        // Intentar usar caché como fallback
        const cached = cacheService.get<Conversation[]>(cacheKey)
        if (cached) {
          console.log('📦 Usando caché como fallback después de error de sesión')
          setConversations(cached)
          setError(null)
          setLoading(false)
          return
        }
        throw new Error('Sesión expirada. Por favor, recarga la página.')
      }

      const { data, error: fetchError } = await supabase
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      const conversationsData = data || []
      setConversations(conversationsData)
      // Guardar en caché (2 minutos - se actualiza frecuentemente por realtime)
      cacheService.set(cacheKey, conversationsData, 2 * 60 * 1000)
      setError(null)
    } catch (err: any) {
      console.error('Error fetching conversations:', err)
      
      // Como último recurso, intentar usar caché
      const cached = cacheService.get<Conversation[]>(cacheKey)
      if (cached) {
        console.log('📦 Usando caché como último recurso después de error')
        setConversations(cached)
        setError(null)
        setLoading(false)
        return
      }
      
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Asegurar que el refresh de sesión esté configurado
    setupSessionRefresh()

    const checkAuthAndFetch = async () => {
      // Primero intentar desde caché (instantáneo)
      const cached = cacheService.get<Conversation[]>('conversations')
      if (cached) {
        console.log('📦 Using cached conversations (instant)')
        setConversations(cached)
        setLoading(false)
        setError(null)
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return
      }

      // Refrescar sesión si es necesario
      try {
        await supabase.auth.getSession()
      } catch (err) {
        console.warn('Error verificando sesión:', err)
      }

      await fetchConversations()
    }

    checkAuthAndFetch()

    // Detectar cuando vuelves de estar AFK y refrescar sesión + recargar
    let hiddenTime: number | null = null

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        hiddenTime = Date.now()
      } else {
        // Si estuvo oculto más de 5 segundos, refrescar sesión y recargar
        if (hiddenTime && Date.now() - hiddenTime > 5000) {
          console.log('🔄 Detectado retorno de AFK, refrescando sesión y recargando conversaciones')
          
          // Refrescar sesión primero
          try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
              await supabase.auth.refreshSession()
            }
          } catch (err) {
            console.warn('Error refrescando sesión:', err)
          }
          
          // Recargar conversaciones (usará caché primero, luego actualizará)
          fetchConversations(false, true).catch(() => {})
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Suscribirse a cambios en tiempo real
    let channel: ReturnType<typeof supabase.channel> | null = null

    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return null

      // Limpiar canal anterior si existe
      if (channel) {
        await supabase.removeChannel(channel)
      }

      channel = supabase
        .channel(`conversations_changes_${session.user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
            filter: `user_id=eq.${session.user.id}`
          },
          (payload) => {
            console.log('🔄 Realtime update en conversaciones:', payload.eventType, (payload.new as Conversation)?.id)

            if (payload.eventType === 'INSERT') {
              // Agregar nueva conversación al inicio
              const newConversation = payload.new as Conversation
              setConversations(prev => {
                // Evitar duplicados
                if (prev.find(c => c.id === newConversation.id)) {
                  return prev
                }
                // Agregar al inicio y ordenar por last_message_at
                const updated = [newConversation, ...prev]
                const sorted = updated.sort((a, b) => {
                  const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
                  const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
                  return bTime - aTime
                })
                // Actualizar caché
                cacheService.set('conversations', sorted, 2 * 60 * 1000)
                return sorted
              })
            } else if (payload.eventType === 'UPDATE') {
              // Actualizar conversación existente
              const updatedConversation = payload.new as Conversation
              setConversations(prev => {
                const index = prev.findIndex(c => c.id === updatedConversation.id)
                let updated: Conversation[]
                if (index === -1) {
                  // Si no existe, agregarla
                  updated = [updatedConversation, ...prev]
                } else {
                  // Actualizar
                  updated = [...prev]
                  updated[index] = updatedConversation
                }
                const sorted = updated.sort((a, b) => {
                  const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
                  const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
                  return bTime - aTime
                })
                // Actualizar caché
                cacheService.set('conversations', sorted, 2 * 60 * 1000)
                return sorted
              })
            } else if (payload.eventType === 'DELETE') {
              // Eliminar conversación
              const deletedId = payload.old.id
              setConversations(prev => {
                const updated = prev.filter(c => c.id !== deletedId)
                // Actualizar caché
                cacheService.set('conversations', updated, 2 * 60 * 1000)
                return updated
              })
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Suscrito a cambios de conversaciones en tiempo real')
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Error en suscripción de conversaciones')
          } else if (status === 'TIMED_OUT') {
            console.warn('⚠️ Timeout en suscripción de conversaciones')
          } else if (status === 'CLOSED') {
            console.log('ℹ️ Canal de conversaciones cerrado')
          }
        })

      return channel
    }

    setupRealtime()

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        // Configurar nuevo canal y recargar
        await setupRealtime()
        await fetchConversations()
      } else {
        if (channel) {
          await supabase.removeChannel(channel)
          channel = null
        }
        setConversations([])
        setLoading(false)
      }
    })

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (channel) {
        supabase.removeChannel(channel)
      }
      subscription.unsubscribe()
    }
  }, [])

  return {
    conversations,
    loading,
    error,
    refetch: fetchConversations,
  }
}
