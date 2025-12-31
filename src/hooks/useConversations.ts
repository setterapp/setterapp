import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export interface Contact {
  id: string
  platform: 'whatsapp' | 'instagram'
  external_id: string
  display_name?: string | null
  phone?: string | null
  username?: string | null
  profile_picture?: string | null
  lead_status?: 'cold' | 'warm' | 'booked' | 'closed' | 'not_closed' | null
}

export interface Conversation {
  id: string
  contact: string
  contact_alias?: string | null
  contact_id?: string | null
  contact_ref?: Contact | null
  platform: 'whatsapp' | 'instagram'
  platform_page_id?: string | null  // ID de la integración que creó esta conversación
  agent_id?: string | null
  unread_count: number
  last_message_at?: string
  created_at: string
  updated_at: string
  lead_status?: 'cold' | 'warm' | 'booked' | 'closed' | 'not_closed' | null
  ai_enabled?: boolean
  contact_metadata?: {
    username?: string
    name?: string
    profile_picture?: string
  }
}

// Caché a nivel de módulo para persistir datos entre navegaciones
let cachedConversations: Conversation[] | null = null
let cachedIntegrationIds: Set<string> | null = null

/**
 * Obtiene los IDs de plataforma de las integraciones activas del usuario.
 * Estos IDs se usan para filtrar conversaciones y solo mostrar las de la integración actual.
 */
async function getActiveIntegrationIds(userId: string): Promise<Set<string>> {
  try {
    const { data: integrations } = await supabase
      .from('integrations')
      .select('type, config')
      .eq('user_id', userId)
      .eq('status', 'connected')
      .in('type', ['instagram', 'whatsapp'])

    const ids = new Set<string>()
    for (const integration of integrations || []) {
      const config = integration.config || {}
      // Instagram puede guardar el ID en varios campos
      const instagramIds = [
        config.instagram_business_account_id,
        config.instagram_user_id,
        config.instagram_page_id,
        config.page_id,
      ]
      // WhatsApp usa phone_number_id
      const whatsappIds = [
        config.phone_number_id,
        config.waba_id,
      ]

      for (const id of [...instagramIds, ...whatsappIds]) {
        if (typeof id === 'string' && id.trim()) ids.add(id)
        if (typeof id === 'number') ids.add(String(id))
      }
    }
    return ids
  } catch {
    return new Set()
  }
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>(cachedConversations || [])
  const [loading, setLoading] = useState(!cachedConversations)
  const [error, setError] = useState<string | null>(null)
  const conversationsRef = useRef<Conversation[]>([])
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const isIntentionalCloseRef = useRef(false)
  const fetchAbortRef = useRef<AbortController | null>(null)
  const activeFetchIdRef = useRef(0)
  const channelKeyRef = useRef<string | null>(null)
  const resolveAttemptedRef = useRef<Set<string>>(new Set())
  const refreshTimerRef = useRef<number | null>(null)
  const integrationIdsRef = useRef<Set<string>>(cachedIntegrationIds || new Set())

  const conversationSelect = '*, contact_ref:contacts(id, platform, external_id, display_name, phone, username, profile_picture, lead_status)'

  const sortConversations = (list: Conversation[]) => {
    const ts = (c: Conversation) => {
      const s = c.last_message_at || c.created_at
      const t = new Date(s).getTime()
      return Number.isFinite(t) ? t : 0
    }
    return [...list].sort((a, b) => ts(b) - ts(a))
  }

  const upsertConversationInState = (conv: Conversation) => {
    setConversations(prev => {
      // Verificar si la conversación pertenece a la integración actual
      const activeIds = integrationIdsRef.current
      const belongsToCurrentIntegration =
        activeIds.size === 0 ? false :
        !conv.platform_page_id ? true :
        activeIds.has(conv.platform_page_id)

      // Si no pertenece a la integración actual, no agregarla/actualizarla
      if (!belongsToCurrentIntegration) {
        return prev
      }

      const idx = prev.findIndex(c => c.id === conv.id)
      let newList: Conversation[]
      if (idx === -1) {
        newList = sortConversations([conv, ...prev])
      } else {
        const next = [...prev]
        next[idx] = conv
        newList = sortConversations(next)
      }
      cachedConversations = newList
      return newList
    })
  }

  const fetchConversations = async () => {
    const fetchId = ++activeFetchIdRef.current
    if (fetchAbortRef.current) fetchAbortRef.current.abort()
    const controller = new AbortController()
    fetchAbortRef.current = controller
    const timeoutId = window.setTimeout(() => controller.abort(), 12000)
    try {
      // Solo mostrar loading si NO hay caché
      if (!cachedConversations) {
        setLoading(true)
      }
      setError(null)

      // Obtener sesión para el user_id
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setLoading(false)
        return
      }

      // Obtener IDs de integraciones activas para filtrar conversaciones
      const activeIds = await getActiveIntegrationIds(session.user.id)
      integrationIdsRef.current = activeIds
      cachedIntegrationIds = activeIds

      const { data, error: fetchError } = await supabase
        .from('conversations')
        .select(conversationSelect)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .abortSignal(controller.signal)
      if (fetchError) throw fetchError
      if (fetchId !== activeFetchIdRef.current) return

      // Filtrar conversaciones: solo mostrar las que pertenecen a la integración actual
      // Una conversación pertenece a la integración actual si:
      // 1. No tiene platform_page_id (conversaciones legacy) - las mostramos por compatibilidad
      // 2. Su platform_page_id está en la lista de IDs de integraciones activas
      const allConversations = (data || []) as Conversation[]
      const filteredList = allConversations.filter(conv => {
        // Si no hay integraciones activas, no mostrar nada
        if (activeIds.size === 0) return false

        // Si la conversación no tiene platform_page_id, la mostramos (legacy)
        if (!conv.platform_page_id) return true

        // Solo mostrar si el platform_page_id coincide con una integración activa
        return activeIds.has(conv.platform_page_id)
      })

      // Actualizar estado y caché
      cachedConversations = filteredList
      setConversations(filteredList)

      // Best-effort: si hay conversaciones de Instagram con "ID numérico", intentamos resolver @username/name
      // Requiere la Edge Function `instagram-resolve-profile` desplegada (verify-jwt=true).
      void (async () => {
        const candidates = filteredList
          .filter((c: Conversation) =>
            c.platform === 'instagram' &&
            !c.contact_metadata?.username &&
            !c.contact_metadata?.name &&
            /^\d+$/.test(c.contact || '')
          )
          .slice(0, 10)

        for (const c of candidates) {
          if (resolveAttemptedRef.current.has(c.id)) continue
          resolveAttemptedRef.current.add(c.id)
          try {
            const { data: resolved } = await supabase.functions.invoke('instagram-resolve-profile', {
              body: { conversationId: c.id },
            })
            const updatedConv = (resolved as any)?.conversation as Conversation | undefined
            if (updatedConv?.id) {
              setConversations(prev => {
                const newList = prev.map(x => (x.id === updatedConv.id ? updatedConv : x))
                cachedConversations = newList
                return newList
              })
            }
          } catch {
            // sin logs
          }
        }
      })()
    } catch (err: any) {
      if (fetchId !== activeFetchIdRef.current) return
      const msg = err?.name === 'AbortError'
        ? 'Timeout loading conversations'
        : (err?.message || 'Error fetching conversations')
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
    conversationsRef.current = conversations
  }, [conversations])

  const ensureConversationLoaded = async (conversationId: string) => {
    if (!conversationId) return
    try {
      // Siempre traer la conversación fresca desde la DB (para actualizar last_message_at, unread_count, etc.)
      const { data } = await supabase
        .from('conversations')
        .select(conversationSelect)
        .eq('id', conversationId)
        .maybeSingle()
      if (data) {
        upsertConversationInState(data as Conversation)
      }
    } catch {
      // sin logs
    }
  }

  const markConversationRead = async (conversationId: string) => {
    if (!conversationId) return
    // UI optimista: ocultar badge inmediatamente
    setConversations(prev => {
      const newList = prev.map(c => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
      cachedConversations = newList
      return newList
    })
    // Best-effort persist
    try {
      await supabase
        .from('conversations')
        .update({ unread_count: 0, updated_at: new Date().toISOString() })
        .eq('id', conversationId)
    } catch {
      // sin logs
    }
  }

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return
      }
      await fetchConversations()
    }

    checkAuthAndFetch()

    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return null

      const channelKey = `conversations_changes_${session.user.id}`
      if (channelRef.current && channelKeyRef.current === channelKey) {
        return channelRef.current
      }

      // Si ya existe un canal, lo limpiamos antes de crear uno nuevo
      if (channelRef.current) {
        try {
          isIntentionalCloseRef.current = true
          await supabase.removeChannel(channelRef.current)
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
              table: 'conversations',
            },
            (payload) => {
              const uid = session.user.id
              const rowUserId = (payload.new as any)?.user_id ?? (payload.old as any)?.user_id
              if (rowUserId && rowUserId !== uid) return

              // Para INSERT de conversaciones nuevas, traemos esa conversación y la agregamos al state
              // (esto evita depender de un refetch completo y reduce races).
              if (payload.eventType === 'INSERT') {
                const convId = (payload.new as any)?.id as string | undefined
                if (convId) {
                  setTimeout(() => { void ensureConversationLoaded(convId) }, 50)
                }
              }

              // Para mantener join con `contacts`, hacemos refetch (debounced) en cambios.
              if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current)
              refreshTimerRef.current = window.setTimeout(() => {
                void fetchConversations()
              }, 150)
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'messages',
            },
            (payload) => {
              const uid = session.user.id
              const rowUserId = (payload.new as any)?.user_id ?? (payload.old as any)?.user_id
              if (rowUserId && rowUserId !== uid) return

              // Para INSERT de mensajes: siempre refrescar la conversación afectada
              // (para actualizar last_message_at, unread_count, etc.)
              if (payload.eventType === 'INSERT') {
                const convId = (payload.new as any)?.conversation_id as string | undefined
                if (convId) {
                  // Esperar un tick para evitar races cuando el webhook inserta conversación + mensaje.
                  setTimeout(() => { void ensureConversationLoaded(convId) }, 50)
                }
              }

              // NO hacer fetchConversations() completo — demasiado costoso.
              // ensureConversationLoaded ya actualiza la conversación específica.
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'contacts',
            },
            (payload) => {
              const uid = session.user.id
              const rowUserId = (payload.new as any)?.user_id ?? (payload.old as any)?.user_id
              if (rowUserId && rowUserId !== uid) return
              void fetchConversations()
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'integrations',
            },
            (payload) => {
              const uid = session.user.id
              const rowUserId = (payload.new as any)?.user_id ?? (payload.old as any)?.user_id
              if (rowUserId && rowUserId !== uid) return

              // Si cambia la integración (reconexión, desconexión), refrescar conversaciones
              // para actualizar los IDs de integración y re-filtrar
              const integrationType = (payload.new as any)?.type ?? (payload.old as any)?.type
              if (integrationType === 'instagram' || integrationType === 'whatsapp') {
                // Limpiar caché para forzar re-fetch con nuevos IDs
                cachedIntegrationIds = null
                cachedConversations = null

                if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current)
                refreshTimerRef.current = window.setTimeout(() => {
                  void fetchConversations()
                }, 200)
              }
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
              }
            }

            if (status === 'TIMED_OUT') {
              setTimeout(() => setupRealtime(), 2000)
            }
          })

        channelRef.current = channel
        channelKeyRef.current = channelKey
        return channel
      } catch (error) {
        // Reintentar después de un delay
        setTimeout(() => setupRealtime(), 2000)
        return null
      }
    }

    setupRealtime()

    const handleResume = async () => {
      // En resume, forzamos refetch + resubscribe (sin reload)
      await fetchConversations()
      await setupRealtime()
    }

    window.addEventListener('appsetter:supabase-resume', handleResume as EventListener)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // IMPORTANT: evitar async/await dentro del callback (puede causar deadlocks).
      setTimeout(() => {
        void (async () => {
          if (session) {
            await setupRealtime()
            await fetchConversations()
          } else {
            if (channelRef.current) {
              try {
                isIntentionalCloseRef.current = true
                await supabase.removeChannel(channelRef.current)
              } catch (error) {
                // Sin logs en producción por seguridad
              }
              channelRef.current = null
            }
            setConversations([])
            setLoading(false)
          }
        })()
      }, 0)
    })

    return () => {
      window.removeEventListener('appsetter:supabase-resume', handleResume as EventListener)
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
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
      subscription.unsubscribe()
    }
  }, [])

  return {
    conversations,
    loading,
    error,
    refetch: fetchConversations,
    markConversationRead,
  }
}
