import { useState, useEffect } from 'react'
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

    let channel: ReturnType<typeof supabase.channel> | null = null

    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return null

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
        .subscribe()

      return channel
    }

    setupRealtime()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
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
