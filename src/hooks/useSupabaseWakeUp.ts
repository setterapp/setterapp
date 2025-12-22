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

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        // Guardar cuando el tab se ocultó
        hiddenTimeRef.current = Date.now()
        console.log('💤 App en background')
      } else if (document.visibilityState === 'visible') {
        const timeHidden = hiddenTimeRef.current
          ? Date.now() - hiddenTimeRef.current
          : 0

        console.log(`🔄 App recuperada después de ${Math.round(timeHidden / 1000)}s`)

        try {
          // Si estuvo oculto por más de 30 segundos, hacer reconexión completa
          if (timeHidden > 30000) {
            console.log('🔌 Reconectando Supabase Realtime...')

            // Desconectar todos los canales y la conexión realtime
            await supabase.removeAllChannels()

            // Esperar un momento para que se limpie todo
            await new Promise(resolve => setTimeout(resolve, 100))
          }

          // Refrescar la sesión
          const { data: { session }, error } = await supabase.auth.getSession()

          if (error) {
            console.error('❌ Error al despertar sesión:', error)
          } else if (session) {
            console.log('✅ Sesión de Supabase activada')

            // Forzar un refresh de la sesión para asegurar que el token es válido
            const { error: refreshError } = await supabase.auth.refreshSession()
            if (refreshError) {
              console.error('❌ Error al refrescar sesión:', refreshError)
            }

            // Recargar la página si estuvo oculta por mucho tiempo
            // Los hooks se reengancharán automáticamente
            if (timeHidden > 30000) {
              console.log('🔄 Recargando datos...')
              window.location.reload()
            }
          }
        } catch (err) {
          console.error('❌ Error en useSupabaseWakeUp:', err)
        }

        hiddenTimeRef.current = null
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])
}

