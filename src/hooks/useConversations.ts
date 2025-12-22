import { useState, useEffect, useRef } from 'react'
import { supabase, resetSupabaseClient } from '../lib/supabase'
import { supabaseRest } from '../utils/supabaseRest'
import { dbg } from '../utils/debug'

export interface Conversation {
  id: string
  contact: string
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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const isIntentionalCloseRef = useRef(false)
  const fetchAbortRef = useRef<AbortController | null>(null)
  const activeFetchIdRef = useRef(0)

  const fetchConversations = async () => {
    const fetchId = ++activeFetchIdRef.current
    if (fetchAbortRef.current) fetchAbortRef.current.abort()
    const controller = new AbortController()
    fetchAbortRef.current = controller
    const timeoutId = window.setTimeout(() => controller.abort(), 12000)
    try {
      setLoading(true)
      setError(null)

      dbg('log', 'useConversations.fetchConversations start')

      const queryPromise = supabase
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .abortSignal(controller.signal)

      const result = await Promise.race([
        queryPromise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('supabase-js timeout (pre-fetch hang)')), 1000)),
      ]).catch(async (e) => {
        dbg('warn', 'useConversations fallback REST', e)
        // Crear nuevo AbortController para el fallback (el anterior puede estar abortado)
        const fallbackController = new AbortController()
        const fallbackTimeoutId = window.setTimeout(() => fallbackController.abort(), 8000)
        try {
          // NO usar supabase.auth.getSession() porque también puede estar colgado
          // En su lugar, obtener el token directamente del localStorage
          let accessToken: string | null = null
          try {
            const authData = localStorage.getItem('supabase.auth.token')
            dbg('log', 'fallback REST localStorage raw', authData ? 'exists' : 'null')
            if (authData) {
              const parsed = JSON.parse(authData)
              dbg('log', 'fallback REST parsed keys', Object.keys(parsed))
              // Intentar múltiples formatos de supabase-js
              accessToken = parsed?.access_token ??
                           parsed?.currentSession?.access_token ??
                           parsed?.data?.session?.access_token ??
                           null
            }
          } catch (parseErr) {
            dbg('error', 'fallback REST localStorage parse error', parseErr)
          }
          dbg('log', 'fallback REST accessToken', accessToken ? 'found' : 'null')
          const rows = await supabaseRest<any[]>(
            `/rest/v1/conversations?select=*&order=last_message_at.desc.nullslast,created_at.desc`,
            { accessToken, signal: fallbackController.signal }
          )
          dbg('log', 'fallback REST success', { count: rows.length })
          return { data: rows, error: null }
        } catch (fallbackErr) {
          dbg('error', 'fallback REST failed', fallbackErr)
          throw fallbackErr
        } finally {
          window.clearTimeout(fallbackTimeoutId)
        }
      })

      const { data, error: fetchError } = result as any
      if (fetchError) throw fetchError
      if (fetchId !== activeFetchIdRef.current) return
      setConversations(data || [])
    } catch (err: any) {
      if (fetchId !== activeFetchIdRef.current) return
      const msg = err?.name === 'AbortError'
        ? 'Timeout cargando conversaciones'
        : (err?.message || 'Error fetching conversations')
      setError(msg)
      console.error('Error fetching conversations:', err)
      if (err?.name === 'AbortError') {
        await resetSupabaseClient('fetchConversations:abort')
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

      // Si ya existe un canal, lo limpiamos antes de crear uno nuevo
      if (channelRef.current) {
        try {
          isIntentionalCloseRef.current = true
          await supabase.removeChannel(channelRef.current)
          channelRef.current = null
        } catch (error) {
          console.error('Error removiendo canal anterior:', error)
        }
      }

      try {
        const channel = supabase
          .channel(`conversations_changes_${session.user.id}_${Date.now()}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'conversations',
              filter: `user_id=eq.${session.user.id}`
            },
            (payload) => {
              if (payload.eventType === 'INSERT') {
                const newConversation = payload.new as Conversation
                setConversations(prev => {
                  if (prev.find(c => c.id === newConversation.id)) return prev
                  const updated = [newConversation, ...prev]
                  return updated.sort((a, b) => {
                    const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
                    const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
                    return bTime - aTime
                  })
                })
              } else if (payload.eventType === 'UPDATE') {
                const updatedConversation = payload.new as Conversation
                setConversations(prev => {
                  const index = prev.findIndex(c => c.id === updatedConversation.id)
                  if (index === -1) {
                    const updated = [updatedConversation, ...prev]
                    return updated.sort((a, b) => {
                      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
                      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
                      return bTime - aTime
                    })
                  }
                  const updated = [...prev]
                  updated[index] = updatedConversation
                  return updated.sort((a, b) => {
                    const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
                    const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
                    return bTime - aTime
                  })
                })
              } else if (payload.eventType === 'DELETE') {
                const deletedId = payload.old.id
                setConversations(prev => prev.filter(c => c.id !== deletedId))
              }
            }
          )
          .subscribe(async (status) => {
            console.log(`📡 Estado del canal de conversaciones: ${status}`)

            if (status === 'SUBSCRIBED') {
              console.log('✅ Canal de conversaciones conectado con éxito')
              isIntentionalCloseRef.current = false
            }

            if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              // Solo reconectar si NO fue un cierre intencional
              if (!isIntentionalCloseRef.current) {
                console.warn('⚠️ Conexión de conversaciones perdida. Intentando reconectar en 2s...')
                setTimeout(() => setupRealtime(), 2000)
              } else {
                console.log('🔌 Canal de conversaciones cerrado intencionalmente')
              }
            }

            if (status === 'TIMED_OUT') {
              console.warn('⏱️ Timeout en canal de conversaciones. Reintentando...')
              setTimeout(() => setupRealtime(), 2000)
            }
          })

        channelRef.current = channel
        return channel
      } catch (error) {
        console.error('❌ Error creando canal de conversaciones:', error)
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        await setupRealtime()
        await fetchConversations()
      } else {
        if (channelRef.current) {
          try {
            isIntentionalCloseRef.current = true
            await supabase.removeChannel(channelRef.current)
          } catch (error) {
            console.error('Error removiendo canal:', error)
          }
          channelRef.current = null
        }
        setConversations([])
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
    conversations,
    loading,
    error,
    refetch: fetchConversations,
  }
}
