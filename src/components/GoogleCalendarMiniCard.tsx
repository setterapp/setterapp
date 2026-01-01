import { useState } from 'react'
import GoogleCalendarIcon from './icons/GoogleCalendarIcon'
import { supabase } from '../lib/supabase'
import { googleOAuthDirect } from '../services/google/oauth-direct'

interface GoogleCalendarMiniCardProps {
  integration: {
    id: string
    status: string
    config?: {
      calendar_email?: string
    }
  } | null
  onConnect?: () => void
  onDisconnect?: () => void
}

export default function GoogleCalendarMiniCard({ integration, onConnect, onDisconnect }: GoogleCalendarMiniCardProps) {
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const isConnected = integration?.status === 'connected'
  const calendarEmail = integration?.config?.calendar_email

  const handleConnect = async () => {
    setConnecting(true)
    try {
      await googleOAuthDirect.initiateOAuth()
      onConnect?.()
    } catch (error) {
      console.error('Error connecting Google Calendar:', error)
      alert('Error connecting Google Calendar')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!integration?.id) return
    if (!confirm('Are you sure you want to disconnect Google Calendar?')) return

    setDisconnecting(true)
    try {
      await supabase
        .from('integrations')
        .update({ status: 'disconnected', config: {} })
        .eq('id', integration.id)
      onDisconnect?.()
    } catch (error) {
      console.error('Error disconnecting:', error)
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div
      style={{
        background: 'var(--color-bg-secondary)',
        border: '2px solid #000',
        borderRadius: 'var(--border-radius)',
        padding: 'var(--spacing-md)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-md)',
        marginTop: 'var(--spacing-md)',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: 'var(--border-radius-sm)',
          background: '#4285F4',
          border: '2px solid #000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <GoogleCalendarIcon size={20} color="#fff" />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
            Google Calendar
          </span>
          {isConnected && calendarEmail && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {calendarEmail}
            </span>
          )}
        </div>
        {!isConnected && (
          <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            Connect to enable automatic meeting scheduling
          </p>
        )}
      </div>

      {/* Button */}
      {isConnected ? (
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          style={{
            padding: '6px 12px',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            background: 'var(--color-bg)',
            border: '2px solid #000',
            borderRadius: 'var(--border-radius-sm)',
            cursor: disconnecting ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
          }}
        >
          <span style={{ color: 'var(--color-success)' }}>●</span>
          {disconnecting ? '...' : 'Connected'}
        </button>
      ) : (
        <button
          onClick={handleConnect}
          disabled={connecting}
          style={{
            padding: '6px 12px',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            background: '#4285F4',
            color: '#fff',
            border: '2px solid #000',
            borderRadius: 'var(--border-radius-sm)',
            cursor: connecting ? 'not-allowed' : 'pointer',
          }}
        >
          {connecting ? 'Connecting...' : 'Connect'}
        </button>
      )}
    </div>
  )
}
