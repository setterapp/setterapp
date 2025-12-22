import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { cacheService } from '../services/cache'

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

  const initializeIntegrations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Verificar qué integraciones ya existen para este usuario por tipo
      const { data: existing, error: checkError } = await supabase
        .from('integrations')
        .select('type')
        .eq('user_id', user.id) // ⚠️ CRÍTICO: Filtrar por user_id

      if (checkError) {
        console.error('Error checking existing integrations:', checkError)
        // No lanzar error, solo retornar
        return
      }

      const existingTypes = existing?.map(i => i.type) || []

      // Filtrar solo las integraciones que no existen
      const integrationsToInsert = DEFAULT_INTEGRATIONS
        .filter(integration => !existingTypes.includes(integration.type))
        .map(integration => ({
          name: integration.name,
          type: integration.type,
          user_id: user.id,
          status: 'disconnected' as const,
          config: {},
        }))

      if (integrationsToInsert.length === 0) {
        console.log('✅ Todas las integraciones ya existen para este usuario')
        return
      }

      console.log('📝 Creando integraciones por defecto:', integrationsToInsert)

      // Insertar una por una para manejar errores individualmente
      for (const integration of integrationsToInsert) {
        const { error: insertError } = await supabase
          .from('integrations')
          .insert(integration)

        if (insertError) {
          // Si es error de duplicado, ignorarlo (puede pasar en race conditions)
          if (insertError.code === '23505') {
            console.log(`⚠️ Integración ${integration.type} ya existe (ignorando)`)
            continue
          }
          console.error(`Error inserting integration ${integration.type}:`, insertError)
          // Continuar con la siguiente en lugar de fallar todo
        } else {
          console.log(`✅ Integración ${integration.type} creada`)
        }
      }
    } catch (err: any) {
      // Si es error de duplicado, ignorarlo
      if (err.code === '23505') {
        console.log('⚠️ Integraciones ya existen (ignorando error de duplicado)')
        return
      }
      console.error('Error initializing integrations:', err)
      // No lanzar el error, solo loguearlo para no romper el flujo
    }
  }

  const updateIntegration = async (id: string, updates: Partial<Integration>) => {
    try {
      // Verificar que el usuario esté autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Usuario no autenticado')
      }

      const updateData: any = { ...updates }

      // Si se está conectando, actualizar connected_at
      if (updates.status === 'connected' && !updates.connected_at) {
        updateData.connected_at = new Date().toISOString()
      }
      // Si se está desconectando, limpiar connected_at
      if (updates.status === 'disconnected') {
        updateData.connected_at = null
      }

      console.log('Actualizando integración en DB:', { id, updateData, userId: user.id })

      const { data, error: updateError } = await supabase
        .from('integrations')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id) // Asegurar que solo actualice las del usuario actual
        .select()
        .single()

      if (updateError) {
        console.error('Error al actualizar en Supabase:', updateError)
        throw updateError
      }

      if (!data) {
        console.error('No se devolvió data después de actualizar')
        throw new Error('No se pudo actualizar la integración')
      }

      console.log('✅ Integración actualizada en Supabase:', data)

      // Actualizar estado local inmediatamente
      setIntegrations((prev) => {
        const updated = prev.map((integration) => (integration.id === id ? data : integration))
        // Actualizar caché
        cacheService.remove('integrations')
        cacheService.set('integrations', updated, 5 * 60 * 1000)
        console.log('✅ Estado local actualizado')
        return updated
      })

      return data
    } catch (err: any) {
      console.error('❌ Error en updateIntegration:', err)
      setError(err.message)
      throw err
    }
  }


  const fetchIntegrations = async (useCache: boolean = true) => {
    try {
      // Intentar obtener del caché primero - ANTES de poner loading
      const cacheKey = 'integrations'
      if (useCache) {
        const cached = cacheService.get<Integration[]>(cacheKey)
        if (cached) {
          console.log('📦 Using cached integrations (instant)')
          // Mostrar datos del caché inmediatamente sin loading
          setIntegrations(cached)
          setError(null)
          setLoading(false)
          // Cargar en background para actualizar (sin mostrar loading)
          fetchIntegrations(false).catch(() => {})
          return
        }
      }

      // Solo mostrar loading si no hay caché
      setLoading(true)

      // Obtener el usuario actual para filtrar por user_id
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Usuario no autenticado')
      }

      const { data, error: fetchError } = await supabase
        .from('integrations')
        .select('*')
        .eq('user_id', user.id) // ⚠️ CRÍTICO: Filtrar por user_id
        .neq('type', 'google-calendar') // Excluir Google Calendar desde la query
        .order('created_at', { ascending: true })

      if (fetchError) throw fetchError

      let integrationsData: Integration[] = []

      // Si no hay integraciones, inicializarlas
      if (!data || data.length === 0) {
        await initializeIntegrations()
        // Recargar después de inicializar
        const { data: newData, error: reloadError } = await supabase
          .from('integrations')
          .select('*')
          .eq('user_id', user.id) // ⚠️ CRÍTICO: Filtrar por user_id
          .neq('type', 'google-calendar') // Excluir Google Calendar desde la query
          .order('created_at', { ascending: true })
        if (reloadError) throw reloadError
        integrationsData = newData || []
      } else {
        integrationsData = data
      }


      setIntegrations(integrationsData)
      // Guardar en caché (5 minutos)
      cacheService.set(cacheKey, integrationsData, 5 * 60 * 1000)
      setError(null)
    } catch (err: any) {
      setError(err.message)
      console.error('Error fetching integrations:', err)
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

      await fetchIntegrations()
    }

    checkAuthAndFetch()

    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel('integrations_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'integrations' },
        () => {
          // Invalidar caché y recargar
          cacheService.remove('integrations')
          fetchIntegrations(false)
        }
      )
      .subscribe()

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        await fetchIntegrations()
        // No restaurar automáticamente al iniciar sesión - solo cuando se use Calendar
        // Esto evita redirecciones molestas
      } else {
        setIntegrations([])
        setLoading(false)
      }
    })

    return () => {
      supabase.removeChannel(channel)
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
