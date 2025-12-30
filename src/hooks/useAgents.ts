import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Tipos de agente predefinidos
export type AgentType = 'setter' | 'support' | 'sales' | 'custom'

export interface AgentConfig {
  // Tipo de agente (preset)
  agentType?: AgentType

  // Identidad
  assistantName?: string
  companyName?: string
  ownerName?: string

  // Negocio
  clientGoals?: string
  offerDetails?: string
  businessNiche?: string
  importantLinks?: string[]

  // Comportamiento
  openingQuestion?: string
  activeHoursStart?: string
  activeHoursEnd?: string
  responseInterval?: number

  // Calificación de leads
  enableQualification?: boolean
  qualifyingQuestion?: string
  qualificationCriteria?: string
  disqualifyMessage?: string

  // Personalización
  toneGuidelines?: string
  additionalContext?: string

  // Ejemplos de conversación para que la IA aprenda el estilo
  conversationExamples?: string

  // Estilo de mensajes humanos (múltiples mensajes cortos)
  enableHumanStyle?: boolean

  // Configuración de reuniones con Google Calendar
  enableMeetingScheduling?: boolean
  meetingEmail?: string // email del agente para recibir las reuniones
  meetingDuration?: number // en minutos
  meetingTitle?: string
  meetingDescription?: string
  meetingBufferMinutes?: number // tiempo de buffer entre reuniones
  meetingAvailableHoursStart?: string // ej: "09:00"
  meetingAvailableHoursEnd?: string // ej: "18:00"
  meetingAvailableDays?: string[] // ej: ["monday", "tuesday", "wednesday", "thursday", "friday"]
  meetingTimezone?: string // ej: "Europe/Madrid", "America/Argentina/Buenos_Aires"
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

// Caché a nivel de módulo para persistir datos entre navegaciones
let cachedAgents: Agent[] | null = null

export function useAgents() {
  // Usar datos cacheados si existen, sin mostrar loading
  const [agents, setAgents] = useState<Agent[]>(cachedAgents || [])
  const [loading, setLoading] = useState(!cachedAgents)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const isIntentionalCloseRef = useRef(false)
  const fetchAbortRef = useRef<AbortController | null>(null)
  const activeFetchIdRef = useRef(0)
  const channelKeyRef = useRef<string | null>(null)

  const fetchAgents = async () => {
    const fetchId = ++activeFetchIdRef.current
    if (fetchAbortRef.current) fetchAbortRef.current.abort()
    const controller = new AbortController()
    fetchAbortRef.current = controller
    const timeoutId = window.setTimeout(() => controller.abort(), 12000)
    try {
      // Solo mostrar loading si NO hay caché
      if (!cachedAgents) {
        setLoading(true)
      }
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('agents')
        .select('*')
        .order('created_at', { ascending: false })
        .abortSignal(controller.signal)
      if (fetchError) throw fetchError
      if (fetchId !== activeFetchIdRef.current) return

      // Actualizar estado y caché
      const newData = data || []
      cachedAgents = newData
      setAgents(newData)
    } catch (err: any) {
      if (fetchId !== activeFetchIdRef.current) return
      const msg = err?.name === 'AbortError'
        ? 'Timeout cargando agentes'
        : (err?.message || 'Error fetching agents')
      setError(msg)
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

      const channelKey = `agents_changes_${session.user.id}`
      if (channelRef.current && channelKeyRef.current === channelKey) {
        return
      }

      // Si ya existe un canal, lo limpiamos antes de crear uno nuevo
      if (channelRef.current) {
        try {
          isIntentionalCloseRef.current = true
          supabase.removeChannel(channelRef.current)
          channelRef.current = null
        } catch (error) {
          // Sin logs en producción por seguridad
        }
      }

      try {
        const channel = supabase
          .channel(channelKey)
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
            if (status === 'SUBSCRIBED') {
              isIntentionalCloseRef.current = false
            }

            if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              // Solo reconectar si NO fue un cierre intencional
              if (!isIntentionalCloseRef.current) {
                setTimeout(() => setupRealtime(), 2000)
              } else {
              }
            }

            if (status === 'TIMED_OUT') {
              setTimeout(() => setupRealtime(), 2000)
            }
          })

        channelRef.current = channel
        channelKeyRef.current = channelKey
      } catch (error) {
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
              // Sin logs en producción por seguridad
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
          // Sin logs en producción por seguridad
        }
      }
      channelRef.current = null
      channelKeyRef.current = null
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
        setAgents((prev) => {
          const newList = [data, ...prev]
          cachedAgents = newList
          return newList
        })
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
        setAgents((prev) => {
          const newList = prev.map((agent) => (agent.id === id ? data : agent))
          cachedAgents = newList
          return newList
        })
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
      setAgents((prev) => {
        const newList = prev.filter((agent) => agent.id !== id)
        cachedAgents = newList
        return newList
      })
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
