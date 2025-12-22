import { useState, useEffect, useRef } from 'react'
import { supabase, resetSupabaseClient } from '../lib/supabase'
import { supabaseRest } from '../utils/supabaseRest'
import { dbg } from '../utils/debug'

export interface Integration {
  id: string
  name: string
  type: 'whatsapp' | 'instagram'
  status: 'connected' | 'disconnected'
  config?: Record<string, any>
  connected_at?: string
  created_at: string
  updated_at: string
}

const DEFAULT_INTEGRATIONS = [
  { name: 'WhatsApp Business', type: 'whatsapp' as const },
  { name: 'Instagram', type: 'instagram' as const },
]

export function useIntegrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const isIntentionalCloseRef = useRef(false)
  const activeFetchIdRef = useRef(0)

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = 12000): Promise<T> => {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)),
    ])
  }

  const initializeIntegrations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: existing } = await supabase
        .from('integrations')
        .select('type')
        .eq('user_id', user.id)

      const existingTypes = existing?.map(i => i.type) || []
      const integrationsToInsert = DEFAULT_INTEGRATIONS
        .filter(integration => !existingTypes.includes(integration.type))
        .map(integration => ({
          name: integration.name,
          type: integration.type,
          user_id: user.id,
          status: 'disconnected' as const,
          config: {},
        }))

      if (integrationsToInsert.length === 0) return

      for (const integration of integrationsToInsert) {
        await supabase.from('integrations').insert(integration)
      }
    } catch (err) {
      console.error('Error initializing integrations:', err)
    }
  }

  const fetchIntegrations = async () => {
    const fetchId = ++activeFetchIdRef.current
    try {
      setLoading(true)
      setError(null)

      // Intentar obtener user con timeout, pero si falla, obtenerlo del localStorage
      let user: any = null
      try {
        const result = await withTimeout(supabase.auth.getUser(), 2000).catch(async (e) => {
          console.warn('⚠️ getUser colgado/falló. Reseteando Supabase y reintentando...', e)
          await resetSupabaseClient('fetchIntegrations:getUser')
          return await withTimeout(supabase.auth.getUser(), 2000)
        })
        user = result.data.user
      } catch (getUserErr) {
        // Si falla completamente, intentar obtener del localStorage
        dbg('warn', 'getUser failed, trying localStorage', getUserErr)
        try {
          const authData = localStorage.getItem('supabase.auth.token')
          if (authData) {
            const parsed = JSON.parse(authData)
            user = parsed?.user ?? parsed?.currentSession?.user ?? parsed?.data?.session?.user ?? null
          }
        } catch {
          // Si todo falla, throw
        }
      }

      if (!user) {
        throw new Error('Usuario no autenticado')
      }

      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), 12000)

      const queryPromise = supabase
        .from('integrations')
        .select('*')
        .eq('user_id', user.id)
        .neq('type', 'google-calendar')
        .order('created_at', { ascending: true })
        .abortSignal(controller.signal)

      let result: any
      try {
        result = await Promise.race([
          queryPromise,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('supabase-js timeout (pre-fetch hang)')), 1000)),
        ]).catch(async (e) => {
          dbg('warn', 'useIntegrations fallback REST', e)
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
              `/rest/v1/integrations?select=*&user_id=eq.${user.id}&type=neq.google-calendar&order=created_at.asc`,
              { accessToken, signal: fallbackController.signal }
            )
            dbg('log', 'fallback REST success (integrations)', { count: rows.length })
            return { data: rows, error: null }
          } catch (fallbackErr) {
            dbg('error', 'fallback REST failed (integrations)', fallbackErr)
            throw fallbackErr
          } finally {
            window.clearTimeout(fallbackTimeoutId)
          }
        })
      } finally {
        window.clearTimeout(timeoutId)
      }

      const data: any[] | null = result.data
      const fetchError: any = result.error

      if (fetchError) throw fetchError

      if (!data || data.length === 0) {
        await initializeIntegrations()

        // Re-fetch con fallback REST
        const reQueryPromise = supabase
          .from('integrations')
          .select('*')
          .eq('user_id', user.id)
          .neq('type', 'google-calendar')
          .order('created_at', { ascending: true })

        const reQueryResult = await Promise.race([
          reQueryPromise,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('supabase-js timeout (re-fetch)')), 1000)),
        ]).catch(async (e) => {
          dbg('warn', 'useIntegrations re-query fallback REST', e)
          const fallbackController = new AbortController()
          const fallbackTimeoutId = window.setTimeout(() => fallbackController.abort(), 8000)
          try {
            let accessToken: string | null = null
            try {
              const authData = localStorage.getItem('supabase.auth.token')
              if (authData) {
                const parsed = JSON.parse(authData)
                accessToken = parsed?.access_token ?? null
              }
            } catch {}
            const rows = await supabaseRest<any[]>(
              `/rest/v1/integrations?select=*&user_id=eq.${user.id}&type=neq.google-calendar&order=created_at.asc`,
              { accessToken, signal: fallbackController.signal }
            )
            return { data: rows, error: null }
          } finally {
            window.clearTimeout(fallbackTimeoutId)
          }
        })

        if (reQueryResult.error) throw reQueryResult.error
        if (fetchId !== activeFetchIdRef.current) return
        setIntegrations(reQueryResult.data || [])
      } else {
        if (fetchId !== activeFetchIdRef.current) return
        setIntegrations(data)
      }
    } catch (err: any) {
      if (fetchId !== activeFetchIdRef.current) return
      const msg = err?.name === 'AbortError'
        ? 'Timeout cargando integraciones'
        : (err?.message || 'Error fetching integrations')
      setError(msg)
      console.error('Error fetching integrations:', err)
      if (err?.name === 'AbortError') {
        await resetSupabaseClient('fetchIntegrations:abort')
      }
    } finally {
      if (fetchId !== activeFetchIdRef.current) return
      setLoading(false)
    }
  }

  const updateIntegration = async (id: string, updates: Partial<Integration>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuario no autenticado')

      const updateData: any = { ...updates }
      if (updates.status === 'connected' && !updates.connected_at) {
        updateData.connected_at = new Date().toISOString()
      }
      if (updates.status === 'disconnected') {
        updateData.connected_at = null
      }

      const { data, error: updateError } = await supabase
        .from('integrations')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (updateError) throw updateError
      if (!data) throw new Error('No se pudo actualizar la integración')

      setIntegrations((prev) => prev.map((integration) => (integration.id === id ? data : integration)))
      return data
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return
      }
      await fetchIntegrations()
    }

    checkAuthAndFetch()

    const setupRealtime = async () => {
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
          .channel(`integrations_changes_${Date.now()}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'integrations' }, () => {
            fetchIntegrations()
          })
          .subscribe(async (status) => {
            console.log(`📡 Estado del canal de integraciones: ${status}`)

            if (status === 'SUBSCRIBED') {
              console.log('✅ Canal de integraciones conectado con éxito')
              isIntentionalCloseRef.current = false
            }

            if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              // Solo reconectar si NO fue un cierre intencional
              if (!isIntentionalCloseRef.current) {
                console.warn('⚠️ Conexión de integraciones perdida. Intentando reconectar en 2s...')
                setTimeout(() => setupRealtime(), 2000)
              } else {
                console.log('🔌 Canal de integraciones cerrado intencionalmente')
              }
            }

            if (status === 'TIMED_OUT') {
              console.warn('⏱️ Timeout en canal de integraciones. Reintentando...')
              setTimeout(() => setupRealtime(), 2000)
            }
          })

        channelRef.current = channel
      } catch (error) {
        console.error('❌ Error creando canal de integraciones:', error)
        setTimeout(() => setupRealtime(), 2000)
      }
    }

    setupRealtime()

    const handleResume = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await fetchIntegrations()
      await setupRealtime()
    }

    window.addEventListener('appsetter:supabase-resume', handleResume as EventListener)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        await fetchIntegrations()
        await setupRealtime()
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
        setIntegrations([])
        setLoading(false)
      }
    })

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
      subscription.unsubscribe()
    }
  }, [])

  return {
    integrations,
    loading,
    error,
    updateIntegration,
    refetch: fetchIntegrations,
  }
}
