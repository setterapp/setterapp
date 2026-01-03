import { useTranslation } from 'react-i18next'
import type { CSSProperties } from 'react'

interface LeadStatusBadgeProps {
  status?: 'cold' | 'warm' | 'booked' | 'closed' | 'not_closed' | null
  style?: CSSProperties
  variant?: 'badge' | 'dot'
}

export default function LeadStatusBadge({ status, style, variant = 'badge' }: LeadStatusBadgeProps) {
  const { t } = useTranslation()

  if (!status) {
    if (variant === 'dot') {
      return null
    }
    return (
      <span
        style={{
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-sm)',
          minWidth: '90px',
          display: 'inline-block',
          textAlign: 'center',
          ...style,
        }}
      >
        {t('contacts.status.none')}
      </span>
    )
  }

  const config: Record<string, { bg: string; label: string }> = {
    cold: { bg: '#94a3b8', label: t('contacts.status.cold') },
    warm: { bg: '#f9e2af', label: t('contacts.status.warm') },
    booked: { bg: '#3b82f6', label: t('contacts.status.booked') },
    closed: { bg: '#a6e3a1', label: t('contacts.status.closed') },
    not_closed: { bg: '#f38ba8', label: t('contacts.status.notClosed') },
  }

  const { bg, label } = config[status] || { bg: '#94a3b8', label: status }

  if (variant === 'dot') {
    return (
      <span
        title={label}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 0,
          height: 0,
          borderStyle: 'solid',
          borderWidth: '0 20px 20px 0',
          borderColor: `transparent ${bg} transparent transparent`,
          filter: 'drop-shadow(-1px 1px 0 #000)',
          ...style,
        }}
      />
    )
  }

  return (
    <span
      style={{
        padding: '4px 12px',
        borderRadius: 'var(--border-radius-sm)',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 600,
        border: '2px solid #000',
        backgroundColor: bg,
        color: '#000',
        display: 'inline-block',
        minWidth: '90px',
        textAlign: 'center',
        ...style,
      }}
    >
      {label}
    </span>
  )
}
