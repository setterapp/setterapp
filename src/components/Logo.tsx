interface LogoProps {
  size?: number
  variant?: 'full' | 'icon' | 'stroke'
}

// Versión con colores (para logo principal)
function BotMessageIcon({ size }: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#000000"
      strokeLinecap="round"
      strokeLinejoin="round"
      height={size}
      width={size}
    >
      <path d="M12 6V2H8" strokeWidth="2" />
      <path d="m8 18 -4 4V8a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2Z" strokeWidth="2" fill="#c9dcff" />
      <path d="M2 12h2" strokeWidth="2" />
      <path d="M9 11v2" strokeWidth="2" />
      <path d="M15 11v2" strokeWidth="2" />
      <path d="M20 12h2" strokeWidth="2" />
    </svg>
  )
}

// Versión estilo lucide (para sidebar, usa currentColor y solo stroke)
function BotMessageStrokeIcon({ size }: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      height={size}
      width={size}
    >
      <path d="M12 6V2H8" />
      <path d="m8 18 -4 4V8a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2Z" />
      <path d="M2 12h2" />
      <path d="M9 11v2" />
      <path d="M15 11v2" />
      <path d="M20 12h2" />
    </svg>
  )
}

export default function Logo({ size = 32, variant = 'full' }: LogoProps) {
  if (variant === 'stroke') {
    return <BotMessageStrokeIcon size={size} />
  }

  if (variant === 'icon') {
    return <BotMessageIcon size={size} />
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
      <BotMessageIcon size={size} />
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
