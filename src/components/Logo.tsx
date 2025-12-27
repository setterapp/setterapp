import { Bot } from 'lucide-react'

interface LogoProps {
  size?: number
  variant?: 'full' | 'icon'
}

export default function Logo({ size = 32, variant = 'full' }: LogoProps) {
  if (variant === 'icon') {
    return <Bot size={size} color="#000" strokeWidth={2.5} />
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
      <Bot size={size} color="#000" strokeWidth={2.5} />
      <span style={{
        fontSize: size * 0.6,
        fontWeight: 700,
        color: 'currentColor',
        letterSpacing: '-0.5px'
      }}>
        setterapp.ai
      </span>
    </div>
  )
}
