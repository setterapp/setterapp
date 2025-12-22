import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Hook global para "despertar" Supabase cuando el usuario vuelve a la pestaña
 * Esto resuelve el problema de conexiones WebSocket que se duermen cuando
 * el navegador minimiza la pestaña por más de 5-10 segundos
 *
 * Basado en: https://github.com/supabase/realtime-js/issues/121
 */
export const useSupabaseWakeUp = () => {
  const hiddenTimeRef = useRef<number | null>(null)
  const lastWakeAtRef = useRef<number>(0)

  useEffect(() => {
    const wakeUp = async (reason: 'visibility' | 'focus' | 'online') => {
      const now = Date.now()
      // Debounce: visibilitychange + focus suelen disparar juntos
      if (now - lastWakeAtRef.current < 750) return
      lastWakeAtRef.current = now

      const timeHidden = hiddenTimeRef.current ? now - hiddenTimeRef.current : 0
      // Sin logs en producción por seguridad

      try {
        const dispatchResume = (didResetClient: boolean) => {
          window.dispatchEvent(
            new CustomEvent('appsetter:supabase-resume', {
              detail: { reason, timeHiddenMs: timeHidden, didResetClient },
            })
          )
        }

        const ensureSessionHealthy = async () => {
          const { data: { session }, error } = await supabase.auth.getSession()
          if (error) return { ok: false, error }
          if (!session) return { ok: true, session: null }

          const expiresAtMs = (session.expires_at ?? 0) * 1000
          const msToExpire = expiresAtMs ? expiresAtMs - Date.now() : Number.POSITIVE_INFINITY
          if (!expiresAtMs || msToExpire < 2 * 60 * 1000) {
            const { error: refreshError } = await supabase.auth.refreshSession()
            if (refreshError) return { ok: false, error: refreshError }
          }
          return { ok: true, session }
        }

        const healthCheck = async () => {
          try {
            // Este ping intenta detectar el "zombie state" (fetch/socket/auth colgado)
            // Usar getSession() en lugar de getUser() - más rápido en browser
            // Con timeout agresivo porque puede colgarse post-resume
            const getSessionPromise = supabase.auth.getSession()
            const sessionResult = await Promise.race([
              getSessionPromise,
              new Promise<{ data: { session: null }, error: any }>((_, reject) =>
                setTimeout(() => reject(new Error('getSession timeout in healthCheck')), 2000)
              )
            ]).catch(() => {
              return { data: { session: null }, error: null }
            })

            if (sessionResult.error) return { ok: false, error: sessionResult.error }
            const user = sessionResult.data.session?.user
            if (!user) return { ok: true, skipped: true }

            const { error: pingError } = await supabase
              .from('conversations')
              .select('id', { head: true, count: 'exact' })
              .eq('user_id', user.id)
              .limit(1)

            if (pingError) return { ok: false, error: pingError }
            return { ok: true }
          } catch (e) {
            return { ok: false, error: e }
          }
        }

        // 1) Asegurar sesión/token OK (sin tocar manualmente el WebSocket)
        await ensureSessionHealthy()

        // 2) Disparar un resume normal (para refetch/resubscribe)
        dispatchResume(false)

        // 3) Health-check: si está zombie, intentamos recovery (sin recrear client) y re-disparamos resume
        const hc = await healthCheck()
        if (!hc.ok) {
          dispatchResume(true)
        }
      } catch (err) {
        // En producción evitamos loguear detalles por seguridad
      } finally {
        hiddenTimeRef.current = null
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenTimeRef.current = Date.now()
        return
      }
      if (document.visibilityState === 'visible') {
        void wakeUp('visibility')
      }
    }

    const handleFocus = () => {
      // En algunos browsers focus es más confiable que visibilitychange
      if (document.visibilityState === 'visible') void wakeUp('focus')
    }

    const handleOnline = () => {
      if (document.visibilityState === 'visible') void wakeUp('online')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('online', handleOnline)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('online', handleOnline)
    }
  }, [])
}
