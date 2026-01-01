import { useState, useEffect } from 'react'
import { User, LogOut, Globe, Bell, Shield, Trash2, Settings, CreditCard } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cacheService } from '../services/cache'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '../components/ui/checkbox'
import SectionHeader from '../components/SectionHeader'
import { useSubscription } from '../hooks/useSubscription'
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

// Caché a nivel de módulo para persistir datos entre navegaciones
let cachedSettings: UserSettings | null = null
let cachedUser: SupabaseUser | null = null

const defaultSettings: UserSettings = {
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
}

function SubscriptionSection() {
  const { subscription, plan, isActive, isExpiring, openPortal, loading, messagesUsed, messagesLimit, activeAgentsCount, agentsLimit, knowledgeBasesCount, knowledgeBasesLimit, isAdmin, adminPlanOverride, setAdminPlanOverride } = useSubscription()

  const planNames: Record<string, string> = {
    starter: 'Starter',
    growth: 'Growth',
    premium: 'Premium',
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  // Calculate usage percentage for progress bar
  const usagePercentage = messagesLimit === Infinity ? 0 : Math.min((messagesUsed / messagesLimit) * 100, 100)
  const isNearLimit = usagePercentage >= 80
  const isAtLimit = usagePercentage >= 100

  return (
    <div>
      <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, margin: '0 0 var(--spacing-md) 0', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
        <CreditCard size={18} />
        Subscription
      </h3>

      {/* Admin Plan Override Section */}
      {isAdmin && (
        <div style={{
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          border: '2px solid #000',
          borderRadius: 'var(--border-radius)',
          padding: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-md)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>🔧 ADMIN MODE</span>
          </div>
          <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Simulate Plan (for testing)
          </label>
          <select
            className="input select"
            value={adminPlanOverride || ''}
            onChange={(e) => setAdminPlanOverride(e.target.value as 'starter' | 'growth' | 'premium' | null || null)}
            style={{ fontSize: 'var(--font-size-sm)', padding: '8px 12px', width: '100%' }}
          >
            <option value="">No override (Premium)</option>
            <option value="starter">Starter (1 agent, 2K msgs)</option>
            <option value="growth">Growth (3 agents, 10K msgs)</option>
            <option value="premium">Premium (10 agents, unlimited)</option>
          </select>
          {adminPlanOverride && (
            <p style={{ fontSize: 'var(--font-size-xs)', color: '#92400e', margin: '8px 0 0 0' }}>
              ⚠️ Simulating <strong>{planNames[adminPlanOverride]}</strong> plan limits
            </p>
          )}
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Loading...</p>
      ) : subscription || isAdmin ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: 'var(--border-radius-sm)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                background: plan === 'premium' ? 'linear-gradient(135deg, #f9e2af 0%, #f59e0b 100%)' :
                           plan === 'growth' ? 'var(--color-primary)' : '#e2e8f0',
                color: '#000',
                border: '2px solid #000',
              }}
            >
              {planNames[plan || 'starter']}
            </span>
            <span
              style={{
                padding: '4px 8px',
                borderRadius: 'var(--border-radius-sm)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                background: isActive ? '#a6e3a1' : '#f38ba8',
                color: '#000',
              }}
            >
              {isActive ? 'Active' : (subscription?.status || 'Admin')}
            </span>
          </div>

          {isExpiring && subscription && (
            <p style={{ fontSize: 'var(--font-size-xs)', color: '#f59e0b', margin: 0 }}>
              Your subscription will end on {formatDate(subscription.current_period_end)}
            </p>
          )}

          {/* Messages Usage */}
          <div style={{ marginTop: 'var(--spacing-xs)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Messages Used</span>
              <span style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                color: isAtLimit ? '#f38ba8' : isNearLimit ? '#f59e0b' : 'var(--color-text-secondary)'
              }}>
                {messagesUsed.toLocaleString()} / {messagesLimit === Infinity ? 'Unlimited' : messagesLimit.toLocaleString()}
              </span>
            </div>
            {messagesLimit !== Infinity && (
              <div style={{
                width: '100%',
                height: '8px',
                background: '#e2e8f0',
                borderRadius: '4px',
                overflow: 'hidden',
                border: '1px solid #000'
              }}>
                <div style={{
                  width: `${usagePercentage}%`,
                  height: '100%',
                  background: isAtLimit ? '#f38ba8' : isNearLimit ? '#f59e0b' : '#a6e3a1',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            )}
            {isNearLimit && !isAtLimit && (
              <p style={{ fontSize: 'var(--font-size-xs)', color: '#f59e0b', margin: '4px 0 0 0' }}>
                You're approaching your message limit
              </p>
            )}
            {isAtLimit && (
              <p style={{ fontSize: 'var(--font-size-xs)', color: '#f38ba8', margin: '4px 0 0 0' }}>
                You've reached your message limit. Upgrade to continue.
              </p>
            )}
          </div>

          {/* Agents & Knowledge Bases Usage */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-xs)' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Active Agents</span>
                <span style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: activeAgentsCount >= agentsLimit ? '#f38ba8' : 'var(--color-text-secondary)'
                }}>
                  {activeAgentsCount} / {agentsLimit}
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '6px',
                background: '#e2e8f0',
                borderRadius: '3px',
                overflow: 'hidden',
                border: '1px solid #000'
              }}>
                <div style={{
                  width: `${Math.min((activeAgentsCount / agentsLimit) * 100, 100)}%`,
                  height: '100%',
                  background: activeAgentsCount >= agentsLimit ? '#f38ba8' : '#a6e3a1',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Knowledge Bases</span>
                <span style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: knowledgeBasesCount >= knowledgeBasesLimit ? '#f38ba8' : 'var(--color-text-secondary)'
                }}>
                  {knowledgeBasesCount} / {knowledgeBasesLimit}
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '6px',
                background: '#e2e8f0',
                borderRadius: '3px',
                overflow: 'hidden',
                border: '1px solid #000'
              }}>
                <div style={{
                  width: `${Math.min((knowledgeBasesCount / knowledgeBasesLimit) * 100, 100)}%`,
                  height: '100%',
                  background: knowledgeBasesCount >= knowledgeBasesLimit ? '#f38ba8' : '#a6e3a1',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          </div>

          {subscription?.current_period_end && (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>
              <p style={{ margin: 0 }}>
                <strong>Renews:</strong> {formatDate(subscription.current_period_end)}
              </p>
            </div>
          )}

          <button
            onClick={() => openPortal()}
            className="btn btn--sm"
            style={{ marginTop: 'var(--spacing-xs)', alignSelf: 'flex-start' }}
          >
            <CreditCard size={14} />
            Manage Subscription
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          No active subscription
        </p>
      )}
    </div>
  )
}

function SettingsPage() {
  const { t } = useTranslation()
  const [user, setUser] = useState<SupabaseUser | null>(cachedUser)
  const [loading, setLoading] = useState(!cachedSettings)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [settings, setSettingsState] = useState<UserSettings>(cachedSettings || defaultSettings)

  // Wrapper para actualizar estado y caché
  const setSettings = (newSettings: UserSettings | ((prev: UserSettings) => UserSettings)) => {
    setSettingsState(prev => {
      const updated = typeof newSettings === 'function' ? newSettings(prev) : newSettings
      cachedSettings = updated
      return updated
    })
  }

  useEffect(() => {
    // Si ya tenemos caché, no mostrar loading
    if (cachedSettings && cachedUser) {
      setLoading(false)
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      cachedUser = currentUser

      if (session?.user) {
        const savedLanguage = localStorage.getItem('userLanguage') || 'es'
        const { data: preferences, error } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', session.user.id)
          .single()

        if (!error && preferences) {
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
          i18n.changeLanguage(userSettings.language)
        } else {
          setSettings(prev => ({ ...prev, language: savedLanguage }))
          i18n.changeLanguage(savedLanguage)
        }
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

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
        }, { onConflict: 'user_id' })
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
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      })
      if (error) alert(`Error al iniciar sesión: ${error.message}`)
    } catch (err: any) {
      alert(`Error inesperado: ${err.message}`)
    }
  }

  const handleLogout = async () => {
    try {
      cacheService.clear()
      await supabase.auth.signOut()
    } catch (err: any) {
      alert(`Error al cerrar sesión: ${err.message}`)
    }
  }

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmText !== 'DELETE') return
    setDeleting(true)
    try {
      const userId = user.id
      const { data: conversations } = await supabase.from('conversations').select('id').eq('user_id', userId)
      if (conversations && conversations.length > 0) {
        await supabase.from('messages').delete().in('conversation_id', conversations.map(c => c.id))
      }
      await supabase.from('conversations').delete().eq('user_id', userId)
      await supabase.from('contacts').delete().eq('user_id', userId)
      await supabase.from('meetings').delete().eq('user_id', userId)
      await supabase.from('agents').delete().eq('user_id', userId)
      await supabase.from('integrations').delete().eq('user_id', userId)
      await supabase.from('user_preferences').delete().eq('user_id', userId)
      cacheService.clear()
      await supabase.auth.signOut()
      window.location.href = '/'
    } catch (err: any) {
      alert(`Error al eliminar cuenta: ${err.message}`)
      setDeleting(false)
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

  if (!user) {
    return (
      <div>
        <SectionHeader title="Configuración" icon={<Settings size={24} />} />
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
      </div>
    )
  }

  return (
    <div>
      <SectionHeader title="Configuración" icon={<Settings size={24} />}>
        <button onClick={handleLogout} className="btn btn--sm" style={{ background: '#f38ba8', color: '#000' }}>
          <LogOut size={16} />
          {t('settings.logout')}
        </button>
      </SectionHeader>

      <div className="card" style={{ border: '2px solid #000', padding: 'var(--spacing-lg)' }}>
        {/* Grid de 2 columnas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 'var(--spacing-xl)' }}>

          {/* Columna 1: Perfil y Preferencias */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            {/* Información Personal */}
            <div>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, margin: '0 0 var(--spacing-md) 0', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <User size={18} />
                {t('settings.personalInfo')}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                <div>
                  <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>{t('settings.email')}</label>
                  <p style={{ fontSize: 'var(--font-size-sm)', margin: 0 }}>{user.email}</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)' }}>
                  <div>
                    <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>{t('settings.firstName')}</label>
                    <input
                      type="text"
                      className="input"
                      value={settings.firstName}
                      onChange={(e) => setSettings({ ...settings, firstName: e.target.value })}
                      onBlur={() => saveToSupabase({ firstName: settings.firstName })}
                      style={{ fontSize: 'var(--font-size-sm)', padding: '8px 12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>{t('settings.lastName')}</label>
                    <input
                      type="text"
                      className="input"
                      value={settings.lastName}
                      onChange={(e) => setSettings({ ...settings, lastName: e.target.value })}
                      onBlur={() => saveToSupabase({ lastName: settings.lastName })}
                      style={{ fontSize: 'var(--font-size-sm)', padding: '8px 12px' }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>{t('settings.phone')}</label>
                  <input
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
            <div>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, margin: '0 0 var(--spacing-md) 0', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Globe size={18} />
                {t('settings.profile')}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-sm)' }}>
                  <div>
                    <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>{t('settings.language')}</label>
                    <select
                      className="input select"
                      value={settings.language}
                      onChange={async (e) => {
                        const newLanguage = e.target.value
                        setSettings({ ...settings, language: newLanguage })
                        localStorage.setItem('userLanguage', newLanguage)
                        i18n.changeLanguage(newLanguage)
                        saveToSupabase({ language: newLanguage })
                      }}
                      style={{ fontSize: 'var(--font-size-sm)', padding: '8px 12px' }}
                    >
                      <option value="es">Español</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>{t('settings.theme')}</label>
                    <select
                      className="input select"
                      value={settings.theme}
                      onChange={(e) => {
                        const newTheme = e.target.value as 'light' | 'dark' | 'auto'
                        setSettings({ ...settings, theme: newTheme })
                        saveToSupabase({ theme: newTheme })
                        document.documentElement.classList.toggle('dark', newTheme === 'dark')
                      }}
                      style={{ fontSize: 'var(--font-size-sm)', padding: '8px 12px' }}
                    >
                      <option value="light">{t('settings.themeSettings.light')}</option>
                      <option value="dark">{t('settings.themeSettings.dark')}</option>
                      <option value="auto">{t('settings.themeSettings.system')}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>{t('settings.timezone')}</label>
                  <select
                    className="input select"
                    value={settings.timezone}
                    onChange={(e) => {
                      setSettings({ ...settings, timezone: e.target.value })
                      saveToSupabase({ timezone: e.target.value })
                    }}
                    style={{ fontSize: 'var(--font-size-sm)', padding: '8px 12px' }}
                  >
                    <option value="America/Argentina/Buenos_Aires">Buenos Aires (GMT-3)</option>
                    <option value="America/Mexico_City">México (GMT-6)</option>
                    <option value="Europe/Madrid">Madrid (GMT+1)</option>
                    <option value="America/New_York">New York (GMT-5)</option>
                    <option value="America/Los_Angeles">Los Angeles (GMT-8)</option>
                    <option value="Europe/London">London (GMT+0)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Columna 2: Notificaciones y Cuenta */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            {/* Notificaciones */}
            <div>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, margin: '0 0 var(--spacing-md) 0', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Bell size={18} />
                {t('settings.notifications')}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-xs)' }}>
                {[
                  { key: 'email', label: t('settings.notificationSettings.email') },
                  { key: 'push', label: t('settings.notificationSettings.push') },
                  { key: 'newConversation', label: t('settings.notificationSettings.newConversation') },
                  { key: 'newMessage', label: t('settings.notificationSettings.newMessage') },
                ].map(({ key, label }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', padding: '6px 0' }}>
                    <Checkbox
                      checked={settings.notifications[key as keyof typeof settings.notifications]}
                      onCheckedChange={(checked) => {
                        const newNotifications = { ...settings.notifications, [key]: checked as boolean }
                        setSettings({ ...settings, notifications: newNotifications })
                        saveToSupabase({ notifications: newNotifications })
                      }}
                    />
                    <label style={{ fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}>{label}</label>
                  </div>
                ))}
              </div>
            </div>

            {/* Cuenta */}
            <div>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, margin: '0 0 var(--spacing-md) 0', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Shield size={18} />
                {t('settings.account')}
              </h3>
              <div>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>User ID</label>
                <p style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', margin: 0, wordBreak: 'break-all', color: 'var(--color-text-secondary)' }}>
                  {user.id}
                </p>
              </div>
            </div>

            {/* Subscription */}
            <SubscriptionSection />

            {/* Danger Zone */}
            <div style={{ marginTop: 'auto', paddingTop: 'var(--spacing-md)', borderTop: '2px solid #f38ba8' }}>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, margin: '0 0 var(--spacing-sm) 0', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', color: '#f38ba8' }}>
                <Trash2 size={18} />
                Danger Zone
              </h3>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0 0 var(--spacing-sm) 0' }}>
                Esta acción es irreversible. Se eliminarán todos tus datos.
              </p>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="btn btn--sm"
                style={{ background: 'transparent', border: '2px solid #f38ba8', color: '#f38ba8' }}
              >
                <Trash2 size={14} />
                Eliminar Cuenta
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'var(--spacing-md)'
        }}>
          <div style={{ background: 'var(--color-bg)', borderRadius: 'var(--border-radius-lg)', padding: 'var(--spacing-xl)', maxWidth: '400px', width: '100%', border: '2px solid #000' }}>
            <h3 style={{ margin: 0, marginBottom: 'var(--spacing-md)', color: '#f38ba8' }}>Eliminar Cuenta</h3>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-md)' }}>
              Esta acción no se puede deshacer. Todos tus datos serán eliminados permanentemente.
            </p>
            <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-sm)' }}>
              Escribe <strong>DELETE</strong> para confirmar:
            </p>
            <input
              type="text"
              className="input"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              style={{ marginBottom: 'var(--spacing-md)', width: '100%' }}
            />
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}
                className="btn btn--sm"
                style={{ flex: 1 }}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAccount}
                className="btn btn--danger btn--sm"
                style={{ flex: 1 }}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsPage
