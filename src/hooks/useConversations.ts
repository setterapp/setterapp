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
}

export interface Conversation {
  id: string
  contact: string
  contact_alias?: string | null
  contact_id?: string | null
  contact_ref?: Contact | null
  platform: 'whatsapp' | 'instagram'
  agent_id?: string | null
  unread_count: number
  last_message_at?: string
  created_at: string
  updated_at: string
  lead_status?: 'cold' | 'warm' | 'hot' | null
  contact_metadata?: {
    username?: string
    name?: string
    profile_picture?: string
  }
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const conversationsRef = useRef<Conversation[]>([])
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const isIntentionalCloseRef = useRef(false)
  const fetchAbortRef = useRef<AbortController | null>(null)
  const activeFetchIdRef = useRef(0)
  const channelKeyRef = useRef<string | null>(null)
  const resolveAttemptedRef = useRef<Set<string>>(new Set())
  const refreshTimerRef = useRef<number | null>(null)

  const conversationSelect = '*, contact_ref:contacts(id, platform, external_id, display_name, phone, username, profile_picture)'

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
      const idx = prev.findIndex(c => c.id === conv.id)
      if (idx === -1) return sortConversations([conv, ...prev])
      const next = [...prev]
      next[idx] = conv
      return sortConversations(next)
    })
  }

  const fetchConversations = async () => {
    const fetchId = ++activeFetchIdRef.current
    if (fetchAbortRef.current) fetchAbortRef.current.abort()
    const controller = new AbortController()
    fetchAbortRef.current = controller
    const timeoutId = window.setTimeout(() => controller.abort(), 12000)
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('conversations')
        .select(conversationSelect)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .abortSignal(controller.signal)
      if (fetchError) throw fetchError
      if (fetchId !== activeFetchIdRef.current) return
      const list = (data || []) as Conversation[]
      setConversations(list)

      // Best-effort: si hay conversaciones de Instagram con "ID numérico", intentamos resolver @username/name
      // Requiere la Edge Function `instagram-resolve-profile` desplegada (verify-jwt=true).
      void (async () => {
        const candidates = list
          .filter(c =>
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
              setConversations(prev => prev.map(x => (x.id === updatedConv.id ? updatedConv : x)))
            }
          } catch {
            // sin logs
          }
        }
      })()
    } catch (err: any) {
      if (fetchId !== activeFetchIdRef.current) return
      const msg = err?.name === 'AbortError'
        ? 'Timeout cargando conversaciones'
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
    // Si ya la tenemos, no hacemos nada (evita fetches extra)
    const exists = conversationsRef.current.some(c => c.id === conversationId)
    if (exists) return
    try {
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
    setConversations(prev => prev.map(c => (c.id === conversationId ? { ...c, unread_count: 0 } : c)))
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

              // Si llega un mensaje para una conversación que todavía no está en la lista (nueva),
              // la agregamos sin requerir refresh manual.
              if (payload.eventType === 'INSERT') {
                const convId = (payload.new as any)?.conversation_id as string | undefined
                if (convId) {
                  // Esperar un tick para evitar races cuando el webhook inserta conversación + mensaje.
                  setTimeout(() => { void ensureConversationLoaded(convId) }, 50)
                }
              }
              // Fallback: si por algún motivo no llega el update de `conversations`,
              // al menos refrescamos la lista cuando entra/sale un mensaje.
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
              table: 'contacts',
            },
            (payload) => {
              const uid = session.user.id
              const rowUserId = (payload.new as any)?.user_id ?? (payload.old as any)?.user_id
              if (rowUserId && rowUserId !== uid) return
              void fetchConversations()
            }
          )
          .subscribe(async (status) => {
            console.log('[useConversations] Realtime status:', status)
            if (status === 'SUBSCRIBED') {
              isIntentionalCloseRef.current = false
              console.log('[useConversations] ✅ Realtime SUBSCRIBED successfully')
            }

            if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              console.warn('[useConversations] ⚠️ Realtime CLOSED/ERROR:', status)
              // Solo reconectar si NO fue un cierre intencional
              if (!isIntentionalCloseRef.current) {
                setTimeout(() => setupRealtime(), 2000)
              } else {
              }
            }

            if (status === 'TIMED_OUT') {
              console.warn('[useConversations] ⚠️ Realtime TIMED_OUT')
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
