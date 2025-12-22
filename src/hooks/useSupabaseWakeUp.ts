import { useEffect, useRef } from 'react'
import { supabase, resetSupabaseClient } from '../lib/supabase'
import { dbg } from '../utils/debug'

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
      console.log(`🔄 WakeUp Supabase (${reason}) después de ${Math.round(timeHidden / 1000)}s`)
      dbg('log', `wakeUp(${reason})`, { timeHiddenMs: timeHidden })

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

        const pingDb = async () => {
          const controller = new AbortController()
          const timeoutId = window.setTimeout(() => controller.abort(), 5000)
          try {
            const { error: pingError } = await supabase
              .from('conversations')
              .select('id', { head: true })
              .limit(1)
              .abortSignal(controller.signal)
            if (pingError) return { ok: false, error: pingError }
            return { ok: true }
          } catch (e) {
            return { ok: false, error: e }
          } finally {
            window.clearTimeout(timeoutId)
          }
        }

        const maybeAutoReload = (why: string) => {
          // Evitar loops de reload: máximo 1 por minuto
          const key = 'appsetter:auto_reload_at'
          const last = Number(sessionStorage.getItem(key) || '0')
          const now2 = Date.now()
          if (now2 - last < 60_000) {
            console.warn(`⚠️ Auto-reload bloqueado (cooldown). Razón: ${why}`)
            return
          }
          sessionStorage.setItem(key, String(now2))
          console.warn(`🔁 Auto-reload ejecutado. Razón: ${why}`)
          window.location.reload()
        }

        const healthCheck = async () => {
          try {
            // Este ping intenta detectar el “zombie state” (fetch/socket/auth colgado)
            const { data: { user }, error: userError } = await supabase.auth.getUser()
            if (userError) return { ok: false, error: userError }
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
        const sessionResult = await ensureSessionHealthy()
        if (!sessionResult.ok) console.warn('⚠️ Sesión no saludable en wakeUp:', sessionResult.error)
        dbg('log', 'ensureSessionHealthy result', sessionResult)

        // 2) Disparar un resume normal (para refetch/resubscribe)
        dispatchResume(false)
        dbg('log', 'dispatchResume(false)')

        // 2.5) Si volvimos de background real, verificar que REST no quedó congelado.
        // Si está “stuck”, es indistinguible de tu síntoma (UI no dispara nada / no hay Network).
        if (timeHidden >= 2000) {
          const ping = await pingDb()
          if (!ping.ok) {
            console.warn('❄️ Ping a DB falló/timeout al volver. Intentando recovery...', ping.error)
            dbg('warn', 'pingDb failed; running resetSupabaseClient', ping.error)
            await resetSupabaseClient(`resume:${reason}:ping`)
            const ping2 = await pingDb()
            if (!ping2.ok) {
              // Último recurso: reload automático (equivalente al reload manual que hoy te salva)
              dbg('error', 'pingDb failed after recovery -> auto reload', ping2.error)
              maybeAutoReload('db_ping_timeout_after_resume')
              return
            }
          }
        }

        // 3) Health-check: si está zombie, intentamos recovery (sin recrear client) y re-disparamos resume
        const hc = await healthCheck()
        if (!hc.ok) {
          console.warn('🧟 Supabase parece “zombie” al volver. Reseteando cliente...', hc.error)
          await resetSupabaseClient(`resume:${reason}`)
          await ensureSessionHealthy()
          dispatchResume(true)
        }
      } catch (err) {
        console.error('❌ Error en useSupabaseWakeUp:', err)
      } finally {
        hiddenTimeRef.current = null
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenTimeRef.current = Date.now()
        console.log('💤 App en background')
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
