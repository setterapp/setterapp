import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Hook global para "despertar" Supabase cuando el usuario vuelve a la pestaña
 * Esto resuelve el problema de conexiones WebSocket que se duermen cuando
 * el navegador minimiza la pestaña por más de 5-10 segundos
 */
export const useSupabaseWakeUp = () => {
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 App recuperada. Verificando conexión de Supabase...')

        try {
          // Refrescar la sesión (esto despierta el transporte de red)
          const { error } = await supabase.auth.getSession()

          if (error) {
            console.error('❌ Error al despertar sesión:', error)
          } else {
            console.log('✅ Sesión de Supabase activada')
          }
        } catch (err) {
          console.error('❌ Error en useSupabaseWakeUp:', err)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])
}

