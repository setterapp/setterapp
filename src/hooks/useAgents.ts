import { useState, useEffect, useRef } from 'react'
import { supabase, resetSupabaseClient } from '../lib/supabase'
import { supabaseRest } from '../utils/supabaseRest'
import { dbg } from '../utils/debug'

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
  const isIntentionalCloseRef = useRef(false)
  const fetchAbortRef = useRef<AbortController | null>(null)
  const activeFetchIdRef = useRef(0)

  const fetchAgents = async () => {
    const fetchId = ++activeFetchIdRef.current
    if (fetchAbortRef.current) fetchAbortRef.current.abort()
    const controller = new AbortController()
    fetchAbortRef.current = controller
    const timeoutId = window.setTimeout(() => controller.abort(), 12000)
    try {
      setLoading(true)
      setError(null)

      const queryPromise = supabase
        .from('agents')
        .select('*')
        .order('created_at', { ascending: false })
        .abortSignal(controller.signal)

      const result = await Promise.race([
        queryPromise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('supabase-js timeout (pre-fetch hang)')), 1000)),
      ]).catch(async (e) => {
        dbg('warn', 'useAgents fallback REST', e)
        const fallbackController = new AbortController()
        const fallbackTimeoutId = window.setTimeout(() => fallbackController.abort(), 8000)
        try {
          let accessToken: string | null = null
          try {
            const authData = localStorage.getItem('supabase.auth.token')
            if (authData) {
              const parsed = JSON.parse(authData)
              accessToken = parsed?.access_token ??
                           parsed?.currentSession?.access_token ??
                           parsed?.data?.session?.access_token ??
                           null
            }
          } catch {
            // Si falla, usaremos solo el ANON_KEY
          }
          const rows = await supabaseRest<any[]>(
            `/rest/v1/agents?select=*&order=created_at.desc`,
            { accessToken, signal: fallbackController.signal }
          )
          dbg('log', 'fallback REST success (agents)', { count: rows.length })
          return { data: rows, error: null }
        } catch (fallbackErr) {
          dbg('error', 'fallback REST failed (agents)', fallbackErr)
          throw fallbackErr
        } finally {
          window.clearTimeout(fallbackTimeoutId)
        }
      })

      const { data, error: fetchError } = result as any
      if (fetchError) throw fetchError
      if (fetchId !== activeFetchIdRef.current) return
      setAgents(data || [])
    } catch (err: any) {
      if (fetchId !== activeFetchIdRef.current) return
      const msg = err?.name === 'AbortError'
        ? 'Timeout cargando agentes'
        : (err?.message || 'Error fetching agents')
      setError(msg)
      console.error('Error fetching agents:', err)
      if (err?.name === 'AbortError') {
        await resetSupabaseClient('fetchAgents:abort')
      }
    } finally {
      window.clearTimeout(timeoutId)
      if (fetchId === activeFetchIdRef.current) {
        setLoading(false)
      }
      if (fetchAbortRef.current === controller) {
        fetchAbortRef.current = null
      }
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
          isIntentionalCloseRef.current = true
          supabase.removeChannel(channelRef.current)
          channelRef.current = null
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
              isIntentionalCloseRef.current = false
            }

            if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              // Solo reconectar si NO fue un cierre intencional
              if (!isIntentionalCloseRef.current) {
                console.warn('⚠️ Conexión de agentes perdida. Intentando reconectar en 2s...')
                setTimeout(() => setupRealtime(), 2000)
              } else {
                console.log('🔌 Canal de agentes cerrado intencionalmente')
              }
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
              isIntentionalCloseRef.current = true
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

    const handleResume = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await fetchAgents()
      await setupRealtime()
    }

    window.addEventListener('appsetter:supabase-resume', handleResume as EventListener)

    checkAuthAndFetch()

    return () => {
      window.removeEventListener('appsetter:supabase-resume', handleResume as EventListener)
      if (channelRef.current) {
        try {
          isIntentionalCloseRef.current = true
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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('User not authenticated')
      const user = session.user

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
