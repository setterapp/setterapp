import type { CSSProperties } from 'react'

interface PlatformBadgeProps {
  platform: 'whatsapp' | 'instagram'
  style?: CSSProperties
}

export default function PlatformBadge({ platform, style }: PlatformBadgeProps) {
  const bg = platform === 'whatsapp' ? '#a6e3a1' : '#f38ba8'
  const label = platform === 'whatsapp' ? 'WhatsApp' : 'Instagram'

  return (
    <span
      style={{
        padding: '4px 12px',
        borderRadius: 'var(--border-radius-sm)',
        border: '2px solid #000',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 600,
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
