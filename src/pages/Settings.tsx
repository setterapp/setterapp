import { useState, useEffect } from 'react'
import { Settings, User, LogOut, Globe, Bell, Shield, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cacheService } from '../services/cache'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'

interface UserSettings {
  firstName: string
  lastName: string
  phone: string
  language: string
  timezone: string
  notifications: {
    email: boolean
    push: boolean
    newConversation: boolean
    newMessage: boolean
  }
  theme: 'light' | 'dark' | 'auto'
}

function SettingsPage() {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<UserSettings>({
    firstName: '',
    lastName: '',
    phone: '',
    language: 'es',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    notifications: {
      email: true,
      push: true,
      newConversation: true,
      newMessage: true,
    },
    theme: 'light',
  })

  useEffect(() => {
    // Verificar si hay una sesión activa
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        // Cargar configuración del usuario desde metadata
        const metadata = session.user.user_metadata || {}
        setSettings({
          firstName: metadata.first_name || '',
          lastName: metadata.last_name || '',
          phone: metadata.phone || '',
          language: metadata.language || 'es',
          timezone: metadata.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          notifications: metadata.notifications || {
            email: true,
            push: true,
            newConversation: true,
            newMessage: true,
          },
          theme: metadata.theme || 'light',
        })
      }
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

  const handleSaveSettings = async () => {
    if (!user) return

    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: settings.firstName,
          last_name: settings.lastName,
          phone: settings.phone,
          language: settings.language,
          timezone: settings.timezone,
          notifications: settings.notifications,
          theme: settings.theme,
        },
      })

      if (error) throw error

      // Guardar idioma en localStorage y actualizar i18n
      localStorage.setItem('userLanguage', settings.language)
      i18n.changeLanguage(settings.language)

      // Aplicar tema si cambió
      if (settings.theme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }

      alert('Configuración guardada exitosamente')
    } catch (err: any) {
      console.error('Error al guardar configuración:', err)
      alert(`Error al guardar: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

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
            <h2 className="flex items-center gap-md" style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--spacing-xs)' }}>
              <Settings size={20} />
              Ajustes
            </h2>
            <p style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>Gestiona tu cuenta y preferencias</p>
          </div>
        </div>
      </div>

      {user ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--spacing-md)' }}>
          {/* Información Personal */}
          <div className="card">
            <div className="card-header" style={{ paddingBottom: 'var(--spacing-sm)' }}>
              <h3 className="card-title flex items-center gap-sm" style={{ fontSize: 'var(--font-size-base)', margin: 0 }}>
                <User size={18} />
                Información Personal
              </h3>
            </div>
            <div className="flex flex-col gap-sm">
              <div className="form-group" style={{ marginBottom: 'var(--spacing-sm)' }}>
                <label className="label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>Email</label>
                <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>{user.email}</p>
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--spacing-sm)' }}>
                <label htmlFor="firstName" className="label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>Nombre</label>
                <input
                  id="firstName"
                  type="text"
                  className="input"
                  value={settings.firstName}
                  onChange={(e) => setSettings({ ...settings, firstName: e.target.value })}
                  placeholder="Tu nombre"
                  style={{ fontSize: 'var(--font-size-sm)', padding: '8px 12px' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--spacing-sm)' }}>
                <label htmlFor="lastName" className="label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>Apellido</label>
                <input
                  id="lastName"
                  type="text"
                  className="input"
                  value={settings.lastName}
                  onChange={(e) => setSettings({ ...settings, lastName: e.target.value })}
                  placeholder="Tu apellido"
                  style={{ fontSize: 'var(--font-size-sm)', padding: '8px 12px' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--spacing-sm)' }}>
                <label htmlFor="phone" className="label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>Teléfono</label>
                <input
                  id="phone"
                  type="tel"
                  className="input"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  placeholder="+34 123 456 789"
                  style={{ fontSize: 'var(--font-size-sm)', padding: '8px 12px' }}
                />
              </div>
            </div>
          </div>

          {/* Preferencias */}
          <div className="card">
            <div className="card-header" style={{ paddingBottom: 'var(--spacing-sm)' }}>
              <h3 className="card-title flex items-center gap-sm" style={{ fontSize: 'var(--font-size-base)', margin: 0 }}>
                <Globe size={18} />
                Preferencias
              </h3>
            </div>
            <div className="flex flex-col gap-sm">
              <div className="form-group" style={{ marginBottom: 'var(--spacing-sm)' }}>
                <label htmlFor="language" className="label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>Idioma</label>
                <select
                  id="language"
                  className="input select"
                  value={settings.language}
                  onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                  style={{ fontSize: 'var(--font-size-sm)', padding: '8px 12px' }}
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--spacing-sm)' }}>
                <label htmlFor="timezone" className="label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>Zona Horaria</label>
                <select
                  id="timezone"
                  className="input select"
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  style={{ fontSize: 'var(--font-size-sm)', padding: '8px 12px' }}
                >
                  <option value="Europe/Madrid">Madrid (GMT+1)</option>
                  <option value="America/New_York">New York (GMT-5)</option>
                  <option value="America/Los_Angeles">Los Angeles (GMT-8)</option>
                  <option value="America/Mexico_City">México (GMT-6)</option>
                  <option value="America/Buenos_Aires">Buenos Aires (GMT-3)</option>
                  <option value="Europe/London">London (GMT+0)</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--spacing-sm)' }}>
                <label htmlFor="theme" className="label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>Tema</label>
                <select
                  id="theme"
                  className="input select"
                  value={settings.theme}
                  onChange={(e) => setSettings({ ...settings, theme: e.target.value as 'light' | 'dark' | 'auto' })}
                  style={{ fontSize: 'var(--font-size-sm)', padding: '8px 12px' }}
                >
                  <option value="light">Claro</option>
                  <option value="dark">Oscuro</option>
                  <option value="auto">Automático</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notificaciones */}
          <div className="card">
            <div className="card-header" style={{ paddingBottom: 'var(--spacing-sm)' }}>
              <h3 className="card-title flex items-center gap-sm" style={{ fontSize: 'var(--font-size-base)', margin: 0 }}>
                <Bell size={18} />
                Notificaciones
              </h3>
            </div>
            <div className="flex flex-col gap-sm">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--spacing-xs) 0' }}>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                  <input
                    type="checkbox"
                    checked={settings.notifications.email}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, email: e.target.checked }
                    })}
                    style={{ marginRight: 'var(--spacing-xs)' }}
                  />
                  Email
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--spacing-xs) 0' }}>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                  <input
                    type="checkbox"
                    checked={settings.notifications.push}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, push: e.target.checked }
                    })}
                    style={{ marginRight: 'var(--spacing-xs)' }}
                  />
                  Notificaciones Push
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--spacing-xs) 0' }}>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                  <input
                    type="checkbox"
                    checked={settings.notifications.newConversation}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, newConversation: e.target.checked }
                    })}
                    style={{ marginRight: 'var(--spacing-xs)' }}
                  />
                  Nueva Conversación
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--spacing-xs) 0' }}>
                <label style={{ fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                  <input
                    type="checkbox"
                    checked={settings.notifications.newMessage}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, newMessage: e.target.checked }
                    })}
                    style={{ marginRight: 'var(--spacing-xs)' }}
                  />
                  Nuevo Mensaje
                </label>
              </div>
            </div>
          </div>

          {/* Cuenta y Seguridad */}
          <div className="card">
            <div className="card-header" style={{ paddingBottom: 'var(--spacing-sm)' }}>
              <h3 className="card-title flex items-center gap-sm" style={{ fontSize: 'var(--font-size-base)', margin: 0 }}>
                <Shield size={18} />
                Cuenta y Seguridad
              </h3>
            </div>
            <div className="flex flex-col gap-sm">
              <div className="form-group" style={{ marginBottom: 'var(--spacing-sm)' }}>
                <label className="label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>ID de usuario</label>
                <p className="text-secondary text-sm" style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', margin: 0, wordBreak: 'break-all' }}>
                  {user.id}
                </p>
              </div>
              <div style={{ marginTop: 'var(--spacing-sm)', paddingTop: 'var(--spacing-sm)', borderTop: '2px solid #000' }}>
                <button onClick={handleLogout} className="btn btn--danger btn--sm" style={{ width: '100%' }}>
                  <LogOut size={16} />
                  Cerrar sesión
                </button>
              </div>
            </div>
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

      {/* Botón de guardar */}
      {user && (
        <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="btn btn--primary"
            style={{ minWidth: '150px' }}
          >
            {saving ? (
              <>
                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                Guardando...
              </>
            ) : (
              <>
                <Save size={18} />
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export default SettingsPage
