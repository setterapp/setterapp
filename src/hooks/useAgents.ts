import { useState, useEffect } from 'react'
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
    let channel: any = null
    let subscription: any = null

    const checkAuthAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return
      }

      await fetchAgents()

      channel = supabase
        .channel('agents_changes')
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
        .subscribe()

      const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, newSession) => {
        if (newSession) {
          fetchAgents()
        } else {
          setAgents([])
          setLoading(false)
        }
      })
      subscription = authSub
    }

    checkAuthAndFetch()

    return () => {
      if (channel) supabase.removeChannel(channel)
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
