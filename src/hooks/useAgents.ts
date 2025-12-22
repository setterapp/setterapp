import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export interface AgentConfig {
  assistantName?: string
  companyName?: string
  ownerName?: string
  clientGoals?: string
  offerDetails?: string
  businessNiche?: string
  importantLinks?: string[]
  openingQuestion?: string
  activeHoursStart?: string
  activeHoursEnd?: string
  responseInterval?: number
  enableQualification?: boolean
  qualifyingQuestion?: string
  qualificationCriteria?: string
  disqualifyMessage?: string
  toneGuidelines?: string
  additionalContext?: string
}

export interface Agent {
  id: string
  name: string
  description: string
  platform: 'whatsapp' | 'instagram' | null
  config?: AgentConfig
  created_at: string
  updated_at: string
}

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const fetchAgents = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('agents')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setAgents(data || [])
    } catch (err: any) {
      setError(err.message)
      console.error('Error fetching agents:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let subscription: any = null

    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Si ya existe un canal, lo limpiamos antes de crear uno nuevo
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current)
        } catch (error) {
          console.error('Error removiendo canal anterior:', error)
        }
      }

      try {
        const channel = supabase
          .channel(`agents_changes_${session.user.id}_${Date.now()}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'agents',
              filter: `user_id=eq.${session.user.id}`
            },
            () => {
              fetchAgents()
            }
          )
          .subscribe(async (status) => {
            console.log(`📡 Estado del canal de agentes: ${status}`)

            if (status === 'SUBSCRIBED') {
              console.log('✅ Canal de agentes conectado con éxito')
            }

            if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              console.warn('⚠️ Conexión de agentes perdida. Intentando reconectar en 2s...')
              setTimeout(() => setupRealtime(), 2000)
            }

            if (status === 'TIMED_OUT') {
              console.warn('⏱️ Timeout en canal de agentes. Reintentando...')
              setTimeout(() => setupRealtime(), 2000)
            }
          })

        channelRef.current = channel
      } catch (error) {
        console.error('❌ Error creando canal de agentes:', error)
        setTimeout(() => setupRealtime(), 2000)
      }
    }

    const checkAuthAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return
      }

      await fetchAgents()
      await setupRealtime()

      const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, newSession) => {
        if (newSession) {
          fetchAgents()
          setupRealtime()
        } else {
          if (channelRef.current) {
            try {
              supabase.removeChannel(channelRef.current)
            } catch (error) {
              console.error('Error removiendo canal:', error)
            }
            channelRef.current = null
          }
          setAgents([])
          setLoading(false)
        }
      })
      subscription = authSub
    }

    checkAuthAndFetch()

    return () => {
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current)
        } catch (error) {
          console.error('Error removing channel:', error)
        }
      }
      if (subscription) subscription.unsubscribe()
    }
  }, [])

  const createAgent = async (agent: Omit<Agent, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error: insertError } = await supabase
        .from('agents')
        .insert({
          user_id: user.id,
          name: agent.name,
          description: agent.description,
          platform: agent.platform,
          config: agent.config || null,
        })
        .select()
        .single()

      if (insertError) throw insertError
      if (data) {
        setAgents((prev) => [data, ...prev])
      }
      return data
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }

  const updateAgent = async (id: string, updates: Partial<Agent>) => {
    try {
      const { data, error: updateError } = await supabase
        .from('agents')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError
      if (data) {
        setAgents((prev) => prev.map((agent) => (agent.id === id ? data : agent)))
      }
      return data
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }

  const deleteAgent = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('agents')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      setAgents((prev) => prev.filter((agent) => agent.id !== id))
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }

  return {
    agents,
    loading,
    error,
    createAgent,
    updateAgent,
    deleteAgent,
    refetch: fetchAgents,
  }
}
