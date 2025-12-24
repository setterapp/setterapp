import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export interface Meeting {
  id: string
  user_id: string
  conversation_id?: string | null
  agent_id?: string | null
  calendar_event_id: string
  meeting_date: string
  duration_minutes: number
  meeting_link: string
  lead_name: string
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  metadata?: any
  created_at: string
  updated_at: string
}

export function useMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const fetchMeetings = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('meetings')
        .select('*')
        .order('meeting_date', { ascending: true })

      if (fetchError) throw fetchError

      setMeetings((data || []) as Meeting[])
    } catch (err: any) {
      setError(err?.message || 'Error fetching meetings')
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
      await fetchMeetings()
    }

    checkAuthAndFetch()

    // Setup realtime subscription
    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const channel = supabase
        .channel('meetings_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'meetings',
          },
          () => {
            void fetchMeetings()
          }
        )
        .subscribe()

      channelRef.current = channel
    }

    setupRealtime()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        void fetchMeetings()
      } else {
        setMeetings([])
        setLoading(false)
      }
    })

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
      subscription.unsubscribe()
    }
  }, [])

  const updateMeetingStatus = async (meetingId: string, status: Meeting['status']) => {
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', meetingId)

      if (error) throw error

      // Update local state
      setMeetings(prev => prev.map(m =>
        m.id === meetingId ? { ...m, status } : m
      ))

      return true
    } catch (err: any) {
      console.error('Error updating meeting status:', err)
      return false
    }
  }

  return {
    meetings,
    loading,
    error,
    refetch: fetchMeetings,
    updateMeetingStatus,
  }
}
