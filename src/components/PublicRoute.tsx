import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface PublicRouteProps {
  children: React.ReactNode
}

/**
 * PublicRoute - Redirige al dashboard si el usuario está autenticado
 * Si no está autenticado, muestra el contenido (Landing page, Login, etc.)
 */
function PublicRoute({ children }: PublicRouteProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verificar si hay una sesión activa
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Escuchar cambios en la autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg)',
        }}
      >
        <div className="spinner"></div>
      </div>
    )
  }

  // Si el usuario está autenticado, redirigir a analytics
  if (user) {
    return <Navigate to="/analytics" replace />
  }

  // Si no está autenticado, mostrar el contenido público
  return <>{children}</>
}

export default PublicRoute
