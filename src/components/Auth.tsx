import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

function Auth() {
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
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      if (error) {
        console.error('Error al iniciar sesión:', error)
        alert(`Error al iniciar sesión: ${error.message}`)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error inesperado'
      console.error('Error inesperado:', err)
      alert(`Error inesperado: ${message}`)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return <div className="spinner"></div>
  }

  if (user) {
    return (
      <div className="flex flex-col gap-sm" style={{ padding: 'var(--spacing-sm)' }}>
        <span className="text-sm text-secondary">{user.email}</span>
        <button onClick={handleLogout} className="btn btn--secondary btn--sm">
          Cerrar sesión
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: 'var(--spacing-sm)' }}>
      <button onClick={handleGoogleLogin} className="btn btn--primary btn--sm" style={{ width: '100%' }}>
        Iniciar sesión con Google
      </button>
    </div>
  )
}

export default Auth
