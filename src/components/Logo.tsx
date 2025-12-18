interface LogoProps {
  size?: number
  variant?: 'full' | 'icon'
}

export default function Logo({ size = 32, variant = 'full' }: LogoProps) {
  // Quickreply icon SVG - chat bubble in background color, lightning in danger color
  const QuickReplyIcon = ({ size }: { size: number }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* Chat bubble main body */}
      <rect
        x="2"
        y="2"
        width="18"
        height="14"
        rx="2"
        fill="var(--color-bg)"
        stroke="var(--color-border)"
        strokeWidth="2"
      />
      {/* Chat bubble tail - sobresaliente triangular */}
      <polygon
        points="6,16 10,16 6,22"
        fill="var(--color-bg)"
        stroke="var(--color-border)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Lightning bolt - danger color */}
      <path
        d="M12.5 6.5L9 13h3.5v4.5L16 11h-3.5V6.5z"
        fill="var(--color-danger)"
      />
    </svg>
  )

  if (variant === 'icon') {
    return <QuickReplyIcon size={size} />
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
      <QuickReplyIcon size={size} />
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




