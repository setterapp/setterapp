import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { cacheService } from '../services/cache'
import { setupSessionRefresh } from '../lib/supabase'

export interface AgentConfig {
  // Identidad del asistente
  assistantName?: string
  companyName?: string
  ownerName?: string

  // Información del negocio
  clientGoals?: string
  offerDetails?: string
  businessNiche?: string
  importantLinks?: string[]

  // Comportamiento
  openingQuestion?: string
  activeHoursStart?: string // HH:mm format
  activeHoursEnd?: string // HH:mm format
  responseInterval?: number // minutos

  // Calificación de leads
  enableQualification?: boolean
  qualifyingQuestion?: string
  qualificationCriteria?: string
  disqualifyMessage?: string

  // Personalización
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

  const fetchAgents = async (useCache: boolean = true) => {
    try {
      // Intentar obtener del caché primero - ANTES de poner loading
      const cacheKey = 'agents'
      if (useCache) {
        const cached = cacheService.get<Agent[]>(cacheKey)
        if (cached) {
          console.log('📦 Using cached agents (instant)')
          // Mostrar datos del caché inmediatamente sin loading
          setAgents(cached)
          setError(null)
          setLoading(false)
          // Cargar en background para actualizar (sin mostrar loading)
          fetchAgents(false).catch(() => {})
          return
        }
      }

      // Solo mostrar loading si no hay caché
      setLoading(true)

      // Si no hay caché o se fuerza refresh, obtener de la DB
      const { data, error: fetchError } = await supabase
        .from('agents')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      const agentsData = data || []
      setAgents(agentsData)
      setError(null)

      // Guardar en caché (5 minutos)
      cacheService.set(cacheKey, agentsData, 5 * 60 * 1000)
    } catch (err: any) {
      setError(err.message)
      console.error('Error fetching agents:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Asegurar que el refresh de sesión esté configurado
    setupSessionRefresh()

    let channel: any = null
    let subscription: any = null

    const checkAuthAndFetch = async () => {
      // Primero intentar desde caché (instantáneo)
      const cached = cacheService.get<Agent[]>('agents')
      if (cached) {
        console.log('📦 Using cached agents (instant)')
        setAgents(cached)
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

      await fetchAgents()

      // Suscribirse a cambios en tiempo real después de obtener la sesión
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
          (payload) => {
            console.log('Agents change detected:', payload)
            // Invalidar caché y recargar
            cacheService.remove('agents')
            fetchAgents(false)
          }
        )
        .subscribe((status) => {
          console.log('Agents subscription status:', status)
        })

      // Escuchar cambios de autenticación
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
      if (channel) {
        supabase.removeChannel(channel)
      }
      if (subscription) {
        subscription.unsubscribe()
      }
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

      // Actualizar estado local inmediatamente
      if (data) {
        setAgents((prev) => {
          const updated = [data, ...prev]
          // Actualizar caché
          cacheService.remove('agents')
          cacheService.set('agents', updated, 5 * 60 * 1000)
          return updated
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

      // Actualizar estado local inmediatamente
      if (data) {
        setAgents((prev) => {
          const updated = prev.map((agent) => (agent.id === id ? data : agent))
          // Actualizar caché
          cacheService.remove('agents')
          cacheService.set('agents', updated, 5 * 60 * 1000)
          return updated
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

      // Actualizar estado local inmediatamente
      setAgents((prev) => {
        const updated = prev.filter((agent) => agent.id !== id)
        // Actualizar caché
        cacheService.remove('agents')
        cacheService.set('agents', updated, 5 * 60 * 1000)
        return updated
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
