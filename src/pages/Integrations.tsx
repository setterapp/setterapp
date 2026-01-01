import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Check, X, MoreVertical, Link2 } from 'lucide-react'
import SectionHeader from '../components/SectionHeader'
import { useTranslation } from 'react-i18next'
import { useIntegrations } from '../hooks/useIntegrations'
import { instagramService } from '../services/facebook/instagram'
import { whatsappService } from '../services/facebook/whatsapp'
import { Switch } from '../components/ui/switch'
import WhatsAppIcon from '../components/icons/WhatsAppIcon'
import InstagramIcon from '../components/icons/InstagramIcon'
import GoogleCalendarIcon from '../components/icons/GoogleCalendarIcon'
import Modal from '../components/common/Modal'
import { googleCalendarService } from '../services/google/calendar'

function Integrations() {
  const { t } = useTranslation()
  const location = useLocation()
  const { integrations, loading, error, updateIntegration, refetch } = useIntegrations()
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [showWhatsAppWarning, setShowWhatsAppWarning] = useState(false)
  const [showGoogleCalendarWarning, setShowGoogleCalendarWarning] = useState(false)



  // Solo hacer refetch extra si venimos de un callback de OAuth
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search)
    const forceRefetch = urlParams.get('refetch') === 'true'

    // Solo si venimos de OAuth callback, hacer refetches adicionales
    // (el hook useIntegrations ya hace el fetch inicial)
    if (forceRefetch) {
      const timers = [
        setTimeout(() => refetch(), 1000),
        setTimeout(() => refetch(), 3000),
      ]
      return () => timers.forEach(timer => clearTimeout(timer))
    }
  }, [location.search])

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null)
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [openMenuId])

  const handleToggle = async (id: string, type: string, checked: boolean) => {
    try {
      const integration = integrations.find(i => i.id === id)
      if (!integration) {
        console.error('Integration not found:', id)
        return
      }

      if (type === 'instagram') {
        if (checked) {
          // Conectar directamente sin modal
          await handleInstagramConnect()
        } else {
          // Desconectar
          await handleInstagramDisconnect(id)
        }
      } else if (type === 'whatsapp') {
        if (checked) {
          // Mostrar advertencia antes de conectar
          setShowWhatsAppWarning(true)
        } else {
          // Desconectar
          await handleWhatsAppDisconnect(id)
        }
      } else if (type === 'google-calendar') {
        if (checked) {
          // Mostrar advertencia/info antes de conectar
          setShowGoogleCalendarWarning(true)
        } else {
          // Desconectar
          await handleGoogleCalendarDisconnect(id)
        }
      } else {
        const newStatus = checked ? 'connected' : 'disconnected'
        await updateIntegration(id, { status: newStatus })
      }
    } catch (err) {
      console.error('Error toggling integration:', err)
      // Recargar para revertir el estado visual si falló
      await refetch()
    }
  }


  const getIntegrationDescription = (type: string) => {
    return t(`integrations.descriptions.${type}`, '')
  }


  async function handleInstagramConnect() {
    try {
      // Volver al flujo original: login directo de Instagram (popup) + callback /auth/instagram/callback
      // Esto usa el endpoint de Instagram OAuth y NO Facebook OAuth.
      await instagramService.connectInstagram()
    } catch (error: any) {
      console.error('Error connecting Instagram:', error)
      alert(`Error connecting Instagram: ${error.message || 'Unknown error'}`)
      refetch() // Refetch para revertir el toggle si la conexión falló
    }
  }

  async function handleInstagramDisconnect(integrationId?: string) {
    try {
      if (!confirm('Disconnect Instagram?')) {
        refetch()
        return
      }

      const integration = integrationId
        ? integrations.find(i => i.id === integrationId)
        : integrations.find(i => i.type === 'instagram')

      if (!integration) {
        alert('Instagram integration not found')
        refetch()
        return
      }

      await updateIntegration(integration.id, {
        status: 'disconnected',
        connected_at: undefined,
        config: {}
      })

      await instagramService.disconnect()
      refetch()
    } catch (error: any) {
      console.error('Error disconnecting Instagram:', error)
      alert(`Error disconnecting: ${error.message || 'Unknown error'}`)
      refetch()
    }
  }

  async function handleWhatsAppConnect() {
    try {
      await whatsappService.connectWhatsApp()
      // El usuario será redirigido a Facebook OAuth
      // Después volverá a /integrations
    } catch (error: any) {
      console.error('Error connecting WhatsApp:', error)
      alert(`Error connecting WhatsApp: ${error.message || 'Unknown error'}`)
      refetch() // Refetch para revertir el toggle si la conexión falló
    }
  }

  async function handleWhatsAppDisconnect(integrationId?: string) {
    try {
      if (!confirm('Disconnect WhatsApp?')) {
        refetch()
        return
      }

      const integration = integrationId
        ? integrations.find(i => i.id === integrationId)
        : integrations.find(i => i.type === 'whatsapp')

      if (!integration) {
        alert('WhatsApp integration not found')
        refetch()
        return
      }

      await updateIntegration(integration.id, {
        status: 'disconnected',
        connected_at: undefined,
        config: {}
      })

      await whatsappService.disconnect()
      refetch()
    } catch (error: any) {
      console.error('Error disconnecting WhatsApp:', error)
      alert(`Error disconnecting: ${error.message || 'Unknown error'}`)
      refetch()
    }
  }

  async function handleGoogleCalendarConnect() {
    try {
      await googleCalendarService.connectCalendar()
      // El usuario será redirigido a Google OAuth
      // Después volverá a /integrations via el callback
    } catch (error: any) {
      console.error('Error connecting Google Calendar:', error)
      alert(`Error connecting Google Calendar: ${error.message || 'Unknown error'}`)
      refetch() // Refetch para revertir el toggle si la conexión falló
    }
  }

  async function handleGoogleCalendarDisconnect(integrationId?: string) {
    try {
      if (!confirm('Disconnect Google Calendar?')) {
        refetch()
        return
      }

      const integration = integrationId
        ? integrations.find(i => i.id === integrationId)
        : integrations.find(i => i.type === 'google-calendar')

      if (!integration) {
        alert('Google Calendar integration not found')
        refetch()
        return
      }

      await updateIntegration(integration.id, {
        status: 'disconnected',
        connected_at: undefined,
        config: {}
      })

      await googleCalendarService.disconnect()
      refetch()
    } catch (error: any) {
      console.error('Error disconnecting Google Calendar:', error)
      alert(`Error disconnecting: ${error.message || 'Unknown error'}`)
      refetch()
    }
  }

  return (
    <div>
      <SectionHeader title="Integrations" icon={<Link2 size={24} />} />

      {loading ? (
        <div className="card" style={{ border: '2px solid #000' }}>
          <div className="empty-state">
            <div className="spinner"></div>
            <p>{t('common.loading')}</p>
          </div>
        </div>
      ) : error ? (
        <div className="card" style={{ border: '2px solid #000' }}>
          <div className="empty-state">
            <h3>Error</h3>
            <p>{error}</p>
          </div>
        </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                {integrations
                  .filter(integration => integration.type !== 'facebook')
                  .map((integration) => {
            const isConnected = integration.status === 'connected'
            const isWhatsApp = integration.type === 'whatsapp'
            const bg = integration.type === 'whatsapp'
              ? '#a6e3a1'
              : integration.type === 'facebook'
              ? '#89b4fa'
              : integration.type === 'google-calendar'
              ? '#4285F4'
              : '#f38ba8'

            return (
              <div
                key={integration.id}
                className="integration-card"
                style={{
                  background: 'var(--color-bg)',
                  border: '2px solid #000',
                  borderRadius: 'var(--border-radius-lg)',
                  padding: 'var(--spacing-lg)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  opacity: isWhatsApp ? 0.6 : 1,
                }}
              >
                {/* Left: Title and metadata */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: 'var(--border-radius)',
                      background: bg,
                      border: '2px solid #000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {integration.type === 'whatsapp' && (
                      <WhatsAppIcon size={24} color="#000" />
                    )}
                    {integration.type === 'instagram' && (
                      <InstagramIcon size={24} color="#000" />
                    )}
                    {integration.type === 'google-calendar' && (
                      <GoogleCalendarIcon size={24} color="#000" />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                      <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-text)' }}>
                        {integration.name}
                      </h3>
                      {/* Show connected account inline with name */}
                      {isConnected && integration.config?.instagram_username && (
                        <span style={{
                          fontSize: 'var(--font-size-sm)',
                          color: 'var(--color-text-secondary)',
                          fontWeight: 500,
                        }}>
                          @{integration.config.instagram_username}
                        </span>
                      )}
                      {isConnected && integration.config?.calendar_email && (
                        <span style={{
                          fontSize: 'var(--font-size-sm)',
                          color: 'var(--color-text-secondary)',
                          fontWeight: 500,
                        }}>
                          {integration.config.calendar_email}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>
                      {getIntegrationDescription(integration.type)}
                    </p>
                  </div>
                </div>

                {/* Right: Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                  {/* WhatsApp Coming Soon Badge */}
                  {isWhatsApp ? (
                    <span
                      style={{
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        color: 'var(--color-text-secondary)',
                        background: 'var(--color-bg-secondary)',
                        padding: '4px 12px',
                        borderRadius: 'var(--border-radius-sm)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      Coming Soon
                    </span>
                  ) : (
                    <>
                      {/* Active Label */}
                      {isConnected && (
                        <span
                          style={{
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 600,
                            color: 'var(--color-success)',
                            minWidth: '60px',
                            textAlign: 'right',
                          }}
                        >
                          {t('integrations.active')}
                        </span>
                      )}

                      {/* Toggle Switch */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={isConnected}
                          onCheckedChange={(checked) => handleToggle(integration.id, integration.type, checked)}
                        />
                      </div>

                      {/* Menu Icon */}
                      <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenuId(openMenuId === integration.id ? null : integration.id)
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 'var(--spacing-xs)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--color-text-secondary)',
                            borderRadius: 'var(--border-radius-sm)',
                          }}
                        >
                          <MoreVertical size={20} />
                        </button>
                        {openMenuId === integration.id && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              marginTop: 'var(--spacing-xs)',
                              background: 'var(--color-bg)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--border-radius)',
                              boxShadow: 'var(--shadow-md)',
                              padding: 'var(--spacing-xs)',
                              zIndex: 100,
                              minWidth: '150px',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isConnected ? (
                              <button
                                onClick={() => {
                                  handleToggle(integration.id, integration.type, false)
                                  setOpenMenuId(null)
                                }}
                                style={{
                                  width: '100%',
                                  textAlign: 'left',
                                  padding: 'var(--spacing-sm)',
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: 'var(--font-size-sm)',
                                  color: 'var(--color-text)',
                                  borderRadius: 'var(--border-radius-sm)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 'var(--spacing-sm)',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'var(--color-bg-secondary)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent'
                                }}
                              >
                                <X size={16} />
                                {t('integrations.disconnect')}
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    // WhatsApp / Instagram / Messenger usan OAuth automático
                                    handleToggle(integration.id, integration.type, true)
                                    setOpenMenuId(null)
                                  }}
                                  style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: 'var(--spacing-sm)',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 'var(--font-size-sm)',
                                    color: 'var(--color-text)',
                                    borderRadius: 'var(--border-radius-sm)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-sm)',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--color-bg-secondary)'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent'
                                  }}
                                >
                                  <Check size={16} />
                                  {t('integrations.connect')}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          }          )}
        </div>
      )}

      {/* Modal de advertencia para WhatsApp */}
      <Modal
        isOpen={showWhatsAppWarning}
        onClose={() => setShowWhatsAppWarning(false)}
        title={t('integrations.modals.whatsapp.title')}
      >
        <div style={{ padding: 'var(--spacing-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          <div>
            <p style={{ margin: 0, marginBottom: 'var(--spacing-md)' }}>
              {t('integrations.modals.whatsapp.intro')}
            </p>
          </div>

          <div>
            <h4 style={{ margin: 0, marginBottom: 'var(--spacing-sm)' }}>
              {t('integrations.modals.whatsapp.requirementsTitle')}
            </h4>
            <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              <li>{t('integrations.modals.whatsapp.requirement1')}</li>
              <li>{t('integrations.modals.whatsapp.requirement2')}</li>
              <li>{t('integrations.modals.whatsapp.requirement3')}</li>
            </ul>
          </div>

          <div style={{ padding: 'var(--spacing-md)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--border-radius)', border: '1px solid var(--color-border)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              <strong>{t('integrations.modals.whatsapp.noteTitle')}</strong> {t('integrations.modals.whatsapp.noteText')}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
            <button
              onClick={() => setShowWhatsAppWarning(false)}
              className="btn btn--secondary"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={async () => {
                setShowWhatsAppWarning(false)
                await handleWhatsAppConnect()
              }}
              className="btn btn--primary"
            >
              {t('integrations.modals.whatsapp.continueButton')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de información para Google Calendar */}
      <Modal
        isOpen={showGoogleCalendarWarning}
        onClose={() => setShowGoogleCalendarWarning(false)}
        title={t('integrations.modals.googleCalendar.title')}
      >
        <div style={{ padding: 'var(--spacing-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          <div>
            <p style={{ margin: 0, marginBottom: 'var(--spacing-md)' }}>
              {t('integrations.modals.googleCalendar.intro')}
            </p>
          </div>

          <div>
            <h4 style={{ margin: 0, marginBottom: 'var(--spacing-sm)' }}>
              {t('integrations.modals.googleCalendar.benefitsTitle')}
            </h4>
            <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              <li>{t('integrations.modals.googleCalendar.benefit1')}</li>
              <li>{t('integrations.modals.googleCalendar.benefit2')}</li>
              <li>{t('integrations.modals.googleCalendar.benefit3')}</li>
            </ul>
          </div>

          <div>
            <h4 style={{ margin: 0, marginBottom: 'var(--spacing-sm)' }}>
              {t('integrations.modals.googleCalendar.requirementsTitle')}
            </h4>
            <ul style={{ margin: 0, paddingLeft: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              <li>{t('integrations.modals.googleCalendar.requirement1')}</li>
              <li>{t('integrations.modals.googleCalendar.requirement2')}</li>
            </ul>
          </div>

          <div style={{ padding: 'var(--spacing-md)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--border-radius)', border: '1px solid var(--color-border)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              <strong>{t('integrations.modals.googleCalendar.noteTitle')}</strong> {t('integrations.modals.googleCalendar.noteText')}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
            <button
              onClick={() => setShowGoogleCalendarWarning(false)}
              className="btn btn--secondary"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={async () => {
                setShowGoogleCalendarWarning(false)
                await handleGoogleCalendarConnect()
              }}
              className="btn btn--primary"
            >
              {t('integrations.modals.googleCalendar.continueButton')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Integrations
