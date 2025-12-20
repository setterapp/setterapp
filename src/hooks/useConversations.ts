import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { cacheService } from '../services/cache'

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

  const fetchConversations = async (useCache: boolean = true) => {
    try {
      setLoading(true)

      // Intentar obtener del caché primero
      const cacheKey = 'conversations'
      if (useCache) {
        const cached = cacheService.get<Conversation[]>(cacheKey)
        if (cached) {
          console.log('📦 Using cached conversations')
          setConversations(cached)
          setError(null)
          setLoading(false)
          // Cargar en background para actualizar
          fetchConversations(false).catch(() => {})
          return
        }
      }

      const { data, error: fetchError } = await supabase
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      const conversationsData = data || []
      setConversations(conversationsData)
      setError(null)

      // Guardar en caché (2 minutos - las conversaciones cambian más frecuentemente)
      cacheService.set(cacheKey, conversationsData, 2 * 60 * 1000)
    } catch (err: any) {
      setError(err.message)
      console.error('Error fetching conversations:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return
      }
      await fetchConversations()
    }

    checkAuthAndFetch()

    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel('conversations_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => {
          // Invalidar caché y recargar
          cacheService.remove('conversations')
          fetchConversations(false)
        }
      )
      .subscribe()

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchConversations()
      } else {
        setConversations([])
        setLoading(false)
      }
    })

    return () => {
      supabase.removeChannel(channel)
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
