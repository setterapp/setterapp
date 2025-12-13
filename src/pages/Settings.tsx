import { useState, useEffect } from 'react'
import { Settings, User, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cacheService } from '../services/cache'
import type { User as SupabaseUser } from '@supabase/supabase-js'

function SettingsPage() {
  const [user, setUser] = useState<SupabaseUser | null>(null)
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
    } catch (err: any) {
      console.error('Error inesperado:', err)
      alert(`Error inesperado: ${err.message}`)
    }
  }

  const handleLogout = async () => {
    try {
      // Limpiar caché al cerrar sesión
      cacheService.clear()
      await supabase.auth.signOut()
    } catch (err: any) {
      console.error('Error al cerrar sesión:', err)
      alert(`Error al cerrar sesión: ${err.message}`)
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="spinner"></div>
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="flex items-center gap-md">
              <Settings size={28} />
              Ajustes
            </h2>
            <p>Gestiona tu cuenta y preferencias</p>
          </div>
        </div>
      </div>

      {user ? (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title flex items-center gap-md">
              <User size={24} />
              Información de la cuenta
            </h3>
          </div>
          <div className="flex flex-col gap-md">
            <div>
              <label className="label">Email</label>
              <p className="text-secondary">{user.email}</p>
            </div>
            <div>
              <label className="label">ID de usuario</label>
              <p className="text-secondary text-sm" style={{ fontFamily: 'monospace' }}>
                {user.id}
              </p>
            </div>
            <div className="divider"></div>
            <button onClick={handleLogout} className="btn btn--danger">
              <LogOut size={18} />
              Cerrar sesión
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <User size={48} style={{ margin: '0 auto var(--spacing-md)', opacity: 0.5 }} />
            <h3>No has iniciado sesión</h3>
            <p>Inicia sesión para acceder a tus ajustes</p>
            <button onClick={handleGoogleLogin} className="btn btn--primary mt-md">
              Iniciar sesión con Google
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsPage
