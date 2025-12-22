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
    try {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Usuario no autenticado')
      }

      const { data, error: fetchError } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', user.id)
        .neq('type', 'google-calendar')
        .order('created_at', { ascending: true })

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
        setIntegrations(newData || [])
      } else {
        setIntegrations(data)
      }
    } catch (err: any) {
      setError(err.message)
      console.error('Error fetching integrations:', err)
    } finally {
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
