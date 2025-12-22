import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const fetchConversations = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setConversations(data || [])
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

    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return null

      // Si ya existe un canal, lo limpiamos antes de crear uno nuevo
      if (channelRef.current) {
        try {
          await supabase.removeChannel(channelRef.current)
        } catch (error) {
          console.error('Error removiendo canal anterior:', error)
        }
      }

      try {
        const channel = supabase
          .channel(`conversations_changes_${session.user.id}_${Date.now()}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'conversations',
              filter: `user_id=eq.${session.user.id}`
            },
            (payload) => {
              if (payload.eventType === 'INSERT') {
                const newConversation = payload.new as Conversation
                setConversations(prev => {
                  if (prev.find(c => c.id === newConversation.id)) return prev
                  const updated = [newConversation, ...prev]
                  return updated.sort((a, b) => {
                    const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
                    const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
                    return bTime - aTime
                  })
                })
              } else if (payload.eventType === 'UPDATE') {
                const updatedConversation = payload.new as Conversation
                setConversations(prev => {
                  const index = prev.findIndex(c => c.id === updatedConversation.id)
                  if (index === -1) {
                    const updated = [updatedConversation, ...prev]
                    return updated.sort((a, b) => {
                      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
                      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
                      return bTime - aTime
                    })
                  }
                  const updated = [...prev]
                  updated[index] = updatedConversation
                  return updated.sort((a, b) => {
                    const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
                    const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
                    return bTime - aTime
                  })
                })
              } else if (payload.eventType === 'DELETE') {
                const deletedId = payload.old.id
                setConversations(prev => prev.filter(c => c.id !== deletedId))
              }
            }
          )
          .subscribe(async (status) => {
            console.log(`📡 Estado del canal de conversaciones: ${status}`)

            if (status === 'SUBSCRIBED') {
              console.log('✅ Canal de conversaciones conectado con éxito')
            }

            if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              console.warn('⚠️ Conexión de conversaciones perdida. Intentando reconectar en 2s...')
              setTimeout(() => setupRealtime(), 2000)
            }

            if (status === 'TIMED_OUT') {
              console.warn('⏱️ Timeout en canal de conversaciones. Reintentando...')
              setTimeout(() => setupRealtime(), 2000)
            }
          })

        channelRef.current = channel
        return channel
      } catch (error) {
        console.error('❌ Error creando canal de conversaciones:', error)
        // Reintentar después de un delay
        setTimeout(() => setupRealtime(), 2000)
        return null
      }
    }

    setupRealtime()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        await setupRealtime()
        await fetchConversations()
      } else {
        if (channelRef.current) {
          try {
            await supabase.removeChannel(channelRef.current)
          } catch (error) {
            console.error('Error removiendo canal:', error)
          }
          channelRef.current = null
        }
        setConversations([])
        setLoading(false)
      }
    })

    return () => {
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current)
        } catch (error) {
          console.error('Error removing channel:', error)
        }
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
