import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

type DebugEventRow = {
  id: string
  created_at: string
  platform: string
  payload: any
}

/**
 * Debug helper:
 * - Enable by setting `localStorage.appsetter_webhook_debug = '1'`
 * - When enabled, subscribes to `webhook_debug_events` inserts for the authed user
 *   and prints the full payload to the browser console.
 */
export function useWebhookDebug() {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    const enabled = typeof window !== 'undefined' && window.localStorage.getItem('appsetter_webhook_debug') === '1'
    if (!enabled) return

    let cancelled = false

    const start = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId || cancelled) return

      // Ensure single channel
      if (channelRef.current) {
        try { supabase.removeChannel(channelRef.current) } catch {}
        channelRef.current = null
      }

      const channel = supabase
        .channel(`webhook_debug_events_${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'webhook_debug_events', filter: `user_id=eq.${userId}` },
          (payload) => {
            const row = payload.new as DebugEventRow
            // eslint-disable-next-line no-console
            console.log('[webhook]', row.platform, row.created_at, row.payload)
          }
        )
        .subscribe()

      channelRef.current = channel
    }

    start()

    return () => {
      cancelled = true
      if (channelRef.current) {
        try { supabase.removeChannel(channelRef.current) } catch {}
        channelRef.current = null
      }
    }
  }, [])
}


