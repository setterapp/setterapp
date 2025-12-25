import { useState, useEffect } from 'react'
import { User, LogOut, Globe, Bell, Shield } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cacheService } from '../services/cache'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '../components/ui/checkbox'
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
  const { t } = useTranslation()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)
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
        // Obtener idioma de localStorage como fallback
        const savedLanguage = localStorage.getItem('userLanguage') || 'es'

        // Cargar preferencias desde Supabase
        const { data: preferences, error } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', session.user.id)
          .single()

        if (!error && preferences) {
          // Usar preferencias de Supabase
          const userSettings = {
            firstName: preferences.first_name || '',
            lastName: preferences.last_name || '',
            phone: preferences.phone || '',
            language: preferences.language || savedLanguage,
            timezone: preferences.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            notifications: preferences.notifications || {
              email: true,
              push: true,
              newConversation: true,
              newMessage: true,
            },
            theme: preferences.theme || 'light',
          }
          setSettings(userSettings)
          // Aplicar idioma guardado
          i18n.changeLanguage(userSettings.language)
        } else {
          // Si no hay preferencias en Supabase, usar localStorage
          setSettings(prev => ({
            ...prev,
            language: savedLanguage
          }))
          i18n.changeLanguage(savedLanguage)
        }
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

  // Función para guardar automáticamente en Supabase
  const saveToSupabase = async (updates: Partial<UserSettings>) => {
    if (!user) return

    try {
      const settingsToSave = { ...settings, ...updates }
      await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          first_name: settingsToSave.firstName,
          last_name: settingsToSave.lastName,
          phone: settingsToSave.phone,
          language: settingsToSave.language,
          timezone: settingsToSave.timezone,
          notifications: settingsToSave.notifications,
          theme: settingsToSave.theme,
        }, {
          onConflict: 'user_id'
        })
    } catch (err: any) {
      console.error('Error al guardar configuración:', err)
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
      <div className="card" style={{ border: '2px solid #000' }}>
        <div className="empty-state">
          <div className="spinner"></div>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {user ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--spacing-md)' }}>
          {/* Información Personal */}
          <div className="card" style={{ border: '2px solid #000' }}>
            <div className="card-header" style={{ paddingBottom: 'var(--spacing-sm)' }}>
              <h3 className="card-title flex items-center gap-sm" style={{ fontSize: 'var(--font-size-base)', margin: 0 }}>
                <User size={18} />
                {t('settings.personalInfo')}
              </h3>
            </div>
            <div className="flex flex-col gap-sm">
              <div className="form-group" style={{ marginBottom: 'var(--spacing-sm)' }}>
                <label className="label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>{t('settings.email')}</label>
                <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>{user.email}</p>
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--spacing-sm)' }}>
                <label htmlFor="firstName" className="label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>{t('settings.firstName')}</label>
                <input
                  id="firstName"
                  type="text"
                  className="input"
                  value={settings.firstName}
                  onChange={(e) => setSettings({ ...settings, firstName: e.target.value })}
                  onBlur={() => saveToSupabase({ firstName: settings.firstName })}
                  placeholder={t('settings.firstName')}
                  style={{ fontSize: 'var(--font-size-sm)', padding: '8px 12px' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--spacing-sm)' }}>
                <label htmlFor="lastName" className="label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>{t('settings.lastName')}</label>
                <input
                  id="lastName"
                  type="text"
                  className="input"
                  value={settings.lastName}
                  onChange={(e) => setSettings({ ...settings, lastName: e.target.value })}
                  onBlur={() => saveToSupabase({ lastName: settings.lastName })}
                  placeholder={t('settings.lastName')}
                  style={{ fontSize: 'var(--font-size-sm)', padding: '8px 12px' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--spacing-sm)' }}>
                <label htmlFor="phone" className="label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>{t('settings.phone')}</label>
                <input
                  id="phone"
                  type="tel"
                  className="input"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  onBlur={() => saveToSupabase({ phone: settings.phone })}
                  placeholder="+34 123 456 789"
                  style={{ fontSize: 'var(--font-size-sm)', padding: '8px 12px' }}
                />
              </div>
            </div>
          </div>

          {/* Preferencias */}
          <div className="card" style={{ border: '2px solid #000' }}>
            <div className="card-header" style={{ paddingBottom: 'var(--spacing-sm)' }}>
              <h3 className="card-title flex items-center gap-sm" style={{ fontSize: 'var(--font-size-base)', margin: 0 }}>
                <Globe size={18} />
                {t('settings.profile')}
              </h3>
            </div>
            <div className="flex flex-col gap-sm">
              <div className="form-group" style={{ marginBottom: 'var(--spacing-sm)' }}>
                <label htmlFor="language" className="label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>{t('settings.language')}</label>
                <select
                  id="language"
                  className="input select"
                  value={settings.language}
                  onChange={async (e) => {
                    const newLanguage = e.target.value
                    setSettings({ ...settings, language: newLanguage })
                    // Cambiar idioma inmediatamente
                    localStorage.setItem('userLanguage', newLanguage)
                    i18n.changeLanguage(newLanguage)

                    // Guardar automáticamente en Supabase
                    if (user) {
                      await supabase
                        .from('user_preferences')
                        .upsert({
                          user_id: user.id,
                          language: newLanguage,
                          first_name: settings.firstName,
                          last_name: settings.lastName,
                          phone: settings.phone,
                          timezone: settings.timezone,
                          notifications: settings.notifications,
                          theme: settings.theme,
                        }, {
                          onConflict: 'user_id'
                        })
                    }
                  }}
                  style={{ fontSize: 'var(--font-size-sm)', padding: '8px 12px' }}
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--spacing-sm)' }}>
                <label htmlFor="timezone" className="label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>{t('settings.timezone')}</label>
                <select
                  id="timezone"
                  className="input select"
                  value={settings.timezone}
                  onChange={(e) => {
                    const newTimezone = e.target.value
                    setSettings({ ...settings, timezone: newTimezone })
                    saveToSupabase({ timezone: newTimezone })
                  }}
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
                <label htmlFor="theme" className="label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>{t('settings.theme')}</label>
                <select
                  id="theme"
                  className="input select"
                  value={settings.theme}
                  onChange={(e) => {
                    const newTheme = e.target.value as 'light' | 'dark' | 'auto'
                    setSettings({ ...settings, theme: newTheme })
                    saveToSupabase({ theme: newTheme })
                    // Aplicar tema inmediatamente
                    if (newTheme === 'dark') {
                      document.documentElement.classList.add('dark')
                    } else {
                      document.documentElement.classList.remove('dark')
                    }
                  }}
                  style={{ fontSize: 'var(--font-size-sm)', padding: '8px 12px' }}
                >
                  <option value="light">{t('settings.themeSettings.light')}</option>
                  <option value="dark">{t('settings.themeSettings.dark')}</option>
                  <option value="auto">{t('settings.themeSettings.system')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notificaciones */}
          <div className="card" style={{ border: '2px solid #000' }}>
            <div className="card-header" style={{ paddingBottom: 'var(--spacing-sm)' }}>
              <h3 className="card-title flex items-center gap-sm" style={{ fontSize: 'var(--font-size-base)', margin: 0 }}>
                <Bell size={18} />
                {t('settings.notifications')}
              </h3>
            </div>
            <div className="flex flex-col gap-sm">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', padding: 'var(--spacing-xs) 0' }}>
                <Checkbox
                  checked={settings.notifications.email}
                  onCheckedChange={(checked) => {
                    const newNotifications = { ...settings.notifications, email: checked as boolean }
                    setSettings({ ...settings, notifications: newNotifications })
                    saveToSupabase({ notifications: newNotifications })
                  }}
                />
                <label style={{ fontSize: 'var(--font-size-sm)', cursor: 'pointer', userSelect: 'none' }}>
                  {t('settings.notificationSettings.email')}
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', padding: 'var(--spacing-xs) 0' }}>
                <Checkbox
                  checked={settings.notifications.push}
                  onCheckedChange={(checked) => {
                    const newNotifications = { ...settings.notifications, push: checked as boolean }
                    setSettings({ ...settings, notifications: newNotifications })
                    saveToSupabase({ notifications: newNotifications })
                  }}
                />
                <label style={{ fontSize: 'var(--font-size-sm)', cursor: 'pointer', userSelect: 'none' }}>
                  {t('settings.notificationSettings.push')}
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', padding: 'var(--spacing-xs) 0' }}>
                <Checkbox
                  checked={settings.notifications.newConversation}
                  onCheckedChange={(checked) => {
                    const newNotifications = { ...settings.notifications, newConversation: checked as boolean }
                    setSettings({ ...settings, notifications: newNotifications })
                    saveToSupabase({ notifications: newNotifications })
                  }}
                />
                <label style={{ fontSize: 'var(--font-size-sm)', cursor: 'pointer', userSelect: 'none' }}>
                  {t('settings.notificationSettings.newConversation')}
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', padding: 'var(--spacing-xs) 0' }}>
                <Checkbox
                  checked={settings.notifications.newMessage}
                  onCheckedChange={(checked) => {
                    const newNotifications = { ...settings.notifications, newMessage: checked as boolean }
                    setSettings({ ...settings, notifications: newNotifications })
                    saveToSupabase({ notifications: newNotifications })
                  }}
                />
                <label style={{ fontSize: 'var(--font-size-sm)', cursor: 'pointer', userSelect: 'none' }}>
                  {t('settings.notificationSettings.newMessage')}
                </label>
              </div>
            </div>
          </div>

          {/* Cuenta y Seguridad */}
          <div className="card" style={{ border: '2px solid #000' }}>
            <div className="card-header" style={{ paddingBottom: 'var(--spacing-sm)' }}>
              <h3 className="card-title flex items-center gap-sm" style={{ fontSize: 'var(--font-size-base)', margin: 0 }}>
                <Shield size={18} />
                {t('settings.account')}
              </h3>
            </div>
            <div className="flex flex-col gap-sm">
              <div className="form-group" style={{ marginBottom: 'var(--spacing-sm)' }}>
                <label className="label" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-xs)' }}>User ID</label>
                <p className="text-secondary text-sm" style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', margin: 0, wordBreak: 'break-all' }}>
                  {user.id}
                </p>
              </div>
              <div style={{ marginTop: 'var(--spacing-sm)', paddingTop: 'var(--spacing-sm)', borderTop: '2px solid #000' }}>
                <button onClick={handleLogout} className="btn btn--danger btn--sm" style={{ width: '100%' }}>
                  <LogOut size={16} />
                  {t('settings.logout')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ border: '2px solid #000' }}>
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
