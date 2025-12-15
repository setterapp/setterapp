import { useEffect, useState } from 'react'
import { Plug, Check, X, MoreVertical } from 'lucide-react'
import { useIntegrations } from '../hooks/useIntegrations'
import { instagramService } from '../services/facebook/instagram'
import { whatsappService } from '../services/facebook/whatsapp'
import ToggleSwitch from '../components/common/ToggleSwitch'
import IntegrationModal from '../components/IntegrationModal'
import WhatsAppIcon from '../components/icons/WhatsAppIcon'
import InstagramIcon from '../components/icons/InstagramIcon'
import { formatDate, formatFullDate } from '../utils/date'

function Integrations() {
  const { integrations, loading, error, updateIntegration, refetch } = useIntegrations()
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [showConnectModal, setShowConnectModal] = useState<string | null>(null)


  // Recargar datos cuando se monta el componente (útil después del callback de OAuth)
  useEffect(() => {
    // Pequeño delay para asegurar que el callback haya terminado de actualizar la DB
    const timer = setTimeout(() => {
      if (!loading) {
        console.log('🔄 Recargando integraciones después del callback...')
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

  const handleConnectWithToken = async (
    type: 'whatsapp' | 'instagram',
    token: string,
    phoneNumberId?: string,
    businessAccountId?: string
  ) => {
    const integration = integrations.find(i => i.type === type)
    if (!integration) {
      throw new Error(`No se encontró la integración de ${type}`)
    }

    const config: Record<string, any> = { token }
    if (phoneNumberId) config.phoneNumberId = phoneNumberId
    if (businessAccountId) config.businessAccountId = businessAccountId

    await updateIntegration(integration.id, {
      status: 'connected',
      config,
      connected_at: new Date().toISOString(),
    })
  }

  async function handleInstagramConnect() {
    try {
      // Explicar al usuario que Instagram usa Facebook OAuth
      const confirmed = confirm(
        'Para conectar Instagram, necesitarás autorizar a través de Facebook.\n\n' +
        'Esto es normal: Instagram Business API usa la autenticación de Facebook.\n\n' +
        '¿Continuar con la conexión?'
      )
      
      if (!confirmed) {
        refetch() // Revertir el toggle si el usuario cancela
        return
      }

      await instagramService.connectInstagram()
      // El usuario será redirigido a Facebook OAuth
      // Después volverá a /integrations
    } catch (error: any) {
      console.error('Error connecting Instagram:', error)
      alert(`Error al conectar con Facebook/Instagram: ${error.message || 'Error desconocido'}`)
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
                  flexDirection: 'column',
                  gap: 'var(--spacing-md)',
                  transition: 'var(--transition)',
                }}
              >
                {/* Top: Title and metadata */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-md)' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: 'var(--border-radius)',
                      background: 'var(--color-bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {integration.type === 'whatsapp' && (
                      <WhatsAppIcon size={24} color="#a6e3a1" />
                    )}
                    {integration.type === 'instagram' && (
                      <InstagramIcon size={24} color="#f38ba8" />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0, marginBottom: 'var(--spacing-xs)', fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-text)' }}>
                      {integration.name}
                    </h3>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', wordBreak: 'break-word' }}>
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

                {/* Bottom: Controls */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-md)', paddingTop: 'var(--spacing-sm)', borderTop: '1px solid var(--color-border)' }}>
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
                  <ToggleSwitch
                    checked={isConnected}
                    onChange={(checked) => handleToggle(integration.id, integration.type, checked)}
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
                          <button
                            onClick={() => {
                              if (integration.type === 'whatsapp' || integration.type === 'instagram') {
                                setShowConnectModal(integration.type)
                                setOpenMenuId(null)
                              } else {
                                handleToggle(integration.id, integration.type, true)
                                setOpenMenuId(null)
                              }
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

      {/* Modal para conectar WhatsApp/Instagram */}
      {showConnectModal && (
        <IntegrationModal
          isOpen={!!showConnectModal}
          onClose={() => setShowConnectModal(null)}
          integrationType={showConnectModal as 'whatsapp' | 'instagram'}
          onConnect={(token, phoneNumberId, businessAccountId) =>
            handleConnectWithToken(showConnectModal as 'whatsapp' | 'instagram', token, phoneNumberId, businessAccountId)
          }
        />
      )}
    </div>
  )
}

export default Integrations
