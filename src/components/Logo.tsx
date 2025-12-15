interface LogoProps {
  size?: number
  variant?: 'full' | 'icon'
}

export default function Logo({ size = 32, variant = 'full' }: LogoProps) {
  if (variant === 'icon') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Minimalist abstract logo - represents AI/automation */}
        <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" fill="none" />
        <path
          d="M 10 16 Q 16 10 22 16 Q 16 22 10 16"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="16" cy="16" r="3" fill="currentColor" />
      </svg>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        {/* Minimalist abstract logo - represents AI/automation */}
        <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" fill="none" />
        <path
          d="M 10 16 Q 16 10 22 16 Q 16 22 10 16"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="16" cy="16" r="3" fill="currentColor" />
      </svg>
      <span style={{ 
        fontSize: size * 0.6, 
        fontWeight: 700, 
        color: 'currentColor',
        letterSpacing: '-0.5px'
      }}>
        AppSetter
      </span>
    </div>
  )
}
