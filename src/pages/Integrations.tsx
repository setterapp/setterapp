import { useEffect, useState } from 'react'
import { Plug, Check, X, MoreVertical } from 'lucide-react'
import { useIntegrations } from '../hooks/useIntegrations'
import { instagramService } from '../services/facebook/instagram'
import { whatsappService } from '../services/facebook/whatsapp'
import { messengerService } from '../services/facebook/messenger'
import { Switch } from '../components/ui/switch'
import WhatsAppIcon from '../components/icons/WhatsAppIcon'
import InstagramIcon from '../components/icons/InstagramIcon'
import MessengerIcon from '../components/icons/MessengerIcon'
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
      } else if (type === 'messenger') {
        if (checked) {
          await handleMessengerConnect()
        } else {
          await handleMessengerDisconnect(id)
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

  async function handleMessengerConnect() {
    try {
      await messengerService.connectMessenger()
    } catch (error: any) {
      console.error('Error connecting Messenger:', error)
      alert(`Error al conectar Messenger: ${error.message || 'Error desconocido'}`)
      refetch()
    }
  }

  async function handleMessengerDisconnect(integrationId?: string) {
    try {
      if (!confirm('¿Desconectar Messenger?')) {
        refetch()
        return
      }

      const integration = integrationId
        ? integrations.find(i => i.id === integrationId)
        : integrations.find(i => i.type === 'messenger')

      if (!integration) {
        alert('No se encontró la integración de Messenger')
        refetch()
        return
      }

      await updateIntegration(integration.id, {
        status: 'disconnected',
        connected_at: undefined,
        config: {}
      })

      await messengerService.disconnect()
      refetch()
    } catch (error: any) {
      console.error('Error disconnecting Messenger:', error)
      alert(`Error al desconectar: ${error.message || 'Error desconocido'}`)
      refetch()
    }
  }

  async function handleMessengerManualConfig(integrationId: string) {
    try {
      const pageAccessToken = window.prompt('Facebook Page Access Token (requerido)', '')
      if (pageAccessToken === null) return
      const trimmedToken = pageAccessToken.trim()
      if (!trimmedToken) {
        alert('Page Access Token es requerido')
        return
      }

      // Intentar detectar automáticamente Page ID + name desde el token (Page access token => /me devuelve la Page)
      let inferredPageId: string | null = null
      let inferredPageName: string | null = null
      try {
        const res = await fetch(
          `https://graph.facebook.com/v24.0/me?fields=id,name&access_token=${encodeURIComponent(trimmedToken)}`
        )
        const data = await res.json().catch(() => null)
        if (res.ok && data && !data.error && data.id) {
          inferredPageId = String(data.id)
          inferredPageName = data.name ? String(data.name) : null
        }
      } catch {
        // ignore
      }

      // Si no pudimos inferir el Page ID, pedirlo manualmente
      let finalPageId = inferredPageId
      if (!finalPageId) {
        const pageId = window.prompt('Facebook Page ID (requerido)', '')
        if (pageId === null) return
        const trimmedPageId = pageId.trim()
        if (!trimmedPageId) {
          alert('Page ID es requerido')
          return
        }
        finalPageId = trimmedPageId
      }

      await updateIntegration(integrationId, {
        status: 'connected',
        config: {
          page_id: finalPageId,
          page_access_token: trimmedToken,
          ...(inferredPageName ? { page_name: inferredPageName } : {}),
        }
      } as any)
      await refetch()
      alert('✅ Messenger configurado. Ahora configura el Webhook en Meta Developers para empezar a recibir mensajes.')
    } catch (e: any) {
      alert(`No se pudo guardar la configuración: ${e?.message || 'Error desconocido'}`)
      await refetch()
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
              : (integration.type === 'messenger' ? '#89b4fa' : '#f38ba8')

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
                    {integration.type === 'messenger' && (
                      <MessengerIcon size={24} color="#000" />
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
                  {(integration.type === 'instagram' || integration.type === 'messenger') && (
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
                            {/* Fallback manual para Messenger (útil si Facebook OAuth no devuelve Page tokens/scopes) */}
                            {integration.type === 'messenger' && (
                              <button
                                onClick={() => {
                                  handleMessengerManualConfig(integration.id)
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
                                title="Configura Page ID + Page Access Token manualmente"
                              >
                                <Check size={16} />
                                Configurar manualmente
                              </button>
                            )}
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
