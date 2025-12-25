import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Contact = {
  id: string
  user_id: string
  platform: 'whatsapp' | 'instagram'
  external_id: string
  display_name?: string | null
  phone?: string | null
  email?: string | null
  username?: string | null
  profile_picture?: string | null
  last_message_at?: string | null
  lead_status?: 'cold' | 'warm' | 'hot' | 'closed' | 'not_closed' | null
  created_at: string
  updated_at: string
}

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const activeFetchIdRef = useRef(0)

  const fetchContacts = async () => {
    const fetchId = ++activeFetchIdRef.current
    try {
      setLoading(true)
      setError(null)

      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), 12000)
      const { data, error: fetchError } = await supabase
        .from('contacts')
        .select('*')
        .order('updated_at', { ascending: false })
        .abortSignal(controller.signal)
      window.clearTimeout(timeoutId)

      if (fetchError) throw fetchError
      if (fetchId !== activeFetchIdRef.current) return
      setContacts((data || []) as Contact[])
    } catch (err: any) {
      if (fetchId !== activeFetchIdRef.current) return
      const msg = err?.name === 'AbortError'
        ? 'Timeout cargando contactos'
        : (err?.message || 'Error fetching contacts')
      setError(msg)
    } finally {
      if (fetchId === activeFetchIdRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    const start = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return
      }
      await fetchContacts()
    }

    start()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        void (async () => {
          if (session) {
            await fetchContacts()
          } else {
            setContacts([])
            setLoading(false)
          }
        })()
      }, 0)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return {
    contacts,
    loading,
    error,
    refetch: fetchContacts,
  }
}
