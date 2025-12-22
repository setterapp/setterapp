import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// Servicio para mantener la sesión activa cuando vuelves de background
let visibilityChangeHandler: (() => void) | null = null

export const setupSessionRefresh = () => {
  // Evitar múltiples listeners
  if (visibilityChangeHandler) {
    return
  }

  let hiddenTime: number | null = null
  let isRefreshing = false

  visibilityChangeHandler = async () => {
    if (document.hidden) {
      hiddenTime = Date.now()
    } else {
      // Si estuvo oculto más de 5 segundos, refrescar sesión
      if (hiddenTime && Date.now() - hiddenTime > 5000 && !isRefreshing) {
        isRefreshing = true
        try {
          console.log('🔄 Refrescando sesión después de estar en background...')
          
          // Obtener sesión actual
          const { data: { session }, error: sessionError } = await supabase.auth.getSession()
          
          if (sessionError) {
            console.error('Error obteniendo sesión:', sessionError)
            isRefreshing = false
            return
          }

          if (session) {
            // Intentar refrescar el token
            const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
            
            if (refreshError) {
              console.warn('⚠️ Error refrescando sesión:', refreshError)
              // Si el refresh falla, intentar obtener la sesión nuevamente
              await supabase.auth.getSession()
            } else if (refreshedSession) {
              console.log('✅ Sesión refrescada exitosamente')
            }
          } else {
            console.warn('⚠️ No hay sesión activa para refrescar')
          }
        } catch (error) {
          console.error('Error en refresh de sesión:', error)
        } finally {
          isRefreshing = false
        }
      }
    }
  }

  document.addEventListener('visibilitychange', visibilityChangeHandler)
}

export const cleanupSessionRefresh = () => {
  if (visibilityChangeHandler) {
    document.removeEventListener('visibilitychange', visibilityChangeHandler)
    visibilityChangeHandler = null
  }
}

// Inicializar automáticamente
if (typeof window !== 'undefined') {
  setupSessionRefresh()
}
