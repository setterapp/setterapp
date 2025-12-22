import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

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

  const initializeIntegrations = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const user = session.user

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
      // Sin logs en producción por seguridad
    }
  }

  const fetchIntegrations = async () => {
    const fetchId = ++activeFetchIdRef.current
    try {
      setLoading(true)
      setError(null)

      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const user = session?.user

      if (!user) {
        throw new Error('Usuario no autenticado')
      }

      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), 12000)
      const { data, error: fetchError } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', user.id)
        .neq('type', 'google-calendar')
        .order('created_at', { ascending: true })
        .abortSignal(controller.signal)
      window.clearTimeout(timeoutId)

      if (fetchError) throw fetchError

      if (!data || data.length === 0) {
        await initializeIntegrations()
        const { data: newData, error: reloadError } = await supabase
          .from('integrations')
          .select('*')
          .eq('user_id', user.id)
          .neq('type', 'google-calendar')
          .order('created_at', { ascending: true })
        if (reloadError) throw reloadError
        if (fetchId !== activeFetchIdRef.current) return
        setIntegrations(newData || [])
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
    } finally {
      if (fetchId !== activeFetchIdRef.current) return
      setLoading(false)
    }
  }

  const updateIntegration = async (id: string, updates: Partial<Integration>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Usuario no autenticado')
      const user = session.user

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
          // Sin logs en producción por seguridad
        }
      }

      try {
        const { data: { session } } = await supabase.auth.getSession()
        const userId = session?.user?.id
        const channel = supabase
          .channel(userId ? `integrations_changes_${userId}` : `integrations_changes`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'integrations',
              ...(userId ? { filter: `user_id=eq.${userId}` } : {}),
            } as any,
            () => {
              fetchIntegrations()
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
      } catch (error) {
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // IMPORTANT: evitar async/await dentro del callback (puede causar deadlocks).
      setTimeout(() => {
        void (async () => {
          if (session) {
            await fetchIntegrations()
            await setupRealtime()
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
            setIntegrations([])
            setLoading(false)
          }
        })()
      }, 0)
    })

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
