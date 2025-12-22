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
      console.log(`🔄 WakeUp Supabase (${reason}) después de ${Math.round(timeHidden / 1000)}s`)

      try {
        // 1) Re-abrir realtime si el browser lo durmió
        // (connect() es idempotente: si ya está conectado, no debería romper nada)
        try {
          supabase.realtime.connect()
        } catch (e) {
          console.warn('⚠️ No se pudo forzar supabase.realtime.connect()', e)
        }

        // 2) Asegurar que el token es válido (pero sin spamear refresh)
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('❌ Error al obtener sesión en wakeUp:', error)
        } else if (session) {
          const expiresAtMs = (session.expires_at ?? 0) * 1000
          const msToExpire = expiresAtMs ? expiresAtMs - Date.now() : Number.POSITIVE_INFINITY
          // Si expira pronto (o no tenemos expires_at por algún motivo), refrescamos
          if (!expiresAtMs || msToExpire < 2 * 60 * 1000) {
            const { error: refreshError } = await supabase.auth.refreshSession()
            if (refreshError) console.error('❌ Error al refrescar sesión:', refreshError)
          }
        }

        // 3) Disparar un evento global para que los hooks hagan refetch + resubscribe
        window.dispatchEvent(
          new CustomEvent('appsetter:supabase-resume', {
            detail: { reason, timeHiddenMs: timeHidden },
          })
        )
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
