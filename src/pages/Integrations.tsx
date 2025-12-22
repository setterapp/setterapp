import { useEffect, useState } from 'react'
import { Plug, Check, X, MoreVertical } from 'lucide-react'
import { useIntegrations } from '../hooks/useIntegrations'
import { instagramService } from '../services/facebook/instagram'
import { whatsappService } from '../services/facebook/whatsapp'
import { Switch } from '../components/ui/switch'
import WhatsAppIcon from '../components/icons/WhatsAppIcon'
import InstagramIcon from '../components/icons/InstagramIcon'
import { formatDate, formatFullDate } from '../utils/date'

function Integrations() {
  const { integrations, loading, error, updateIntegration, refetch } = useIntegrations()
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const toggleWebhookDebug = async (integrationId: string, enabled: boolean) => {
    const integration = integrations.find(i => i.id === integrationId)
    if (!integration) return
    await updateIntegration(integrationId, {
      config: {
        ...(integration.config || {}),
        debug_webhooks: enabled,
      }
    } as any)
  }


  // Recargar datos cuando se monta el componente (útil después del callback de OAuth)
  useEffect(() => {
    // Pequeño delay para asegurar que el callback haya terminado de actualizar la DB
    const timer = setTimeout(() => {
      if (!loading) {
        refetch()
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, []) // Solo al montar

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
          // Conectar con OAuth de Facebook
          await handleInstagramConnect()
        } else {
          // Desconectar
          await handleInstagramDisconnect(id)
        }
      } else if (type === 'whatsapp') {
        if (checked) {
          // Conectar con OAuth de Facebook
          await handleWhatsAppConnect()
        } else {
          // Desconectar
          await handleWhatsAppDisconnect(id)
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


  async function handleInstagramConnect() {
    try {
      // Volver al flujo original: login directo de Instagram (popup) + callback /auth/instagram/callback
      // Esto usa el endpoint de Instagram OAuth y NO Facebook OAuth.
      await instagramService.connectInstagram()
    } catch (error: any) {
      console.error('Error connecting Instagram:', error)
      alert(`Error al conectar Instagram: ${error.message || 'Error desconocido'}`)
      refetch() // Refetch para revertir el toggle si la conexión falló
    }
  }

  async function handleInstagramDisconnect(integrationId?: string) {
    try {
      if (!confirm('¿Desconectar Instagram?')) {
        refetch()
        return
      }

      const integration = integrationId
        ? integrations.find(i => i.id === integrationId)
        : integrations.find(i => i.type === 'instagram')

      if (!integration) {
        alert('No se encontró la integración de Instagram')
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
      alert(`Error al desconectar: ${error.message || 'Error desconocido'}`)
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
      alert(`Error al conectar con Facebook/WhatsApp: ${error.message || 'Error desconocido'}`)
      refetch() // Refetch para revertir el toggle si la conexión falló
    }
  }

  async function handleWhatsAppDisconnect(integrationId?: string) {
    try {
      if (!confirm('¿Desconectar WhatsApp?')) {
        refetch()
        return
      }

      const integration = integrationId
        ? integrations.find(i => i.id === integrationId)
        : integrations.find(i => i.type === 'whatsapp')

      if (!integration) {
        alert('No se encontró la integración de WhatsApp')
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
      alert(`Error al desconectar: ${error.message || 'Error desconocido'}`)
      refetch()
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="flex items-center gap-md">
              <Plug size={28} />
              Integraciones
            </h2>
            <p>Conecta tus plataformas para automatizar conversaciones</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <div className="empty-state">
            <div className="spinner"></div>
            <p>Cargando integraciones...</p>
          </div>
        </div>
      ) : error ? (
        <div className="card">
          <div className="empty-state">
            <h3>Error</h3>
            <p>{error}</p>
          </div>
        </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                {integrations.map((integration) => {
            const isConnected = integration.status === 'connected'
            const webhookDebugEnabled = Boolean((integration.config as any)?.debug_webhooks)
            const bg = integration.type === 'whatsapp'
              ? '#a6e3a1'
              : '#f38ba8'

            return (
              <div
                key={integration.id}
                className="integration-card"
                style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--border-radius-lg)',
                  padding: 'var(--spacing-lg)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'var(--transition)',
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
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-text)' }}>
                      {integration.name}
                    </h3>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      {integration.updated_at && (
                        <>Última actualización {formatDate(integration.updated_at)}</>
                      )}
                      {integration.created_at && integration.updated_at && ' | '}
                      {integration.created_at && (
                        <>Creado {formatFullDate(integration.created_at)}</>
                      )}
                    </p>
                  </div>
                </div>

                {/* Right: Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                  {/* Webhook Debug (Instagram/Messenger, modo opt-in) */}
                  {integration.type === 'instagram' && (
                    <button
                      onClick={() => toggleWebhookDebug(integration.id, !webhookDebugEnabled)}
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        padding: '6px 10px',
                        borderRadius: 'var(--border-radius-sm)',
                        border: '2px solid #000',
                        background: webhookDebugEnabled ? 'var(--color-primary)' : 'var(--color-bg)',
                        color: '#000',
                        cursor: 'pointer',
                        opacity: isConnected ? 1 : 0.6,
                      }}
                      title={isConnected
                        ? 'Guarda payloads de webhooks y los envía por Realtime (solo para debug)'
                        : 'Puedes activar Debug aunque esté desconectado. Luego conecta la integración para recibir eventos.'}
                    >
                      {webhookDebugEnabled ? 'Debug ON' : 'Debug OFF'}
                    </button>
                  )}

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
                      Activo
                    </span>
                  )}

                  {/* Toggle Switch */}
                  <Switch
                    checked={isConnected}
                    onCheckedChange={(checked) => handleToggle(integration.id, integration.type, checked)}
                  />

                  {/* Menu Icon */}
                  <div style={{ position: 'relative' }}>
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
                            Desconectar
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
                              Conectar
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          }          )}
        </div>
      )}

      {/* Modal para conectar WhatsApp/Instagram - Ya no se usa, solo OAuth automático */}
      {/* Se mantiene por si acaso se necesita en el futuro, pero no se muestra */}
    </div>
  )
}

export default Integrations
