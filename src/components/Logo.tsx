interface LogoProps {
  size?: number
  variant?: 'full' | 'icon'
}

// Custom SetterApp logo - Original design
function SetterBotIcon({ size }: { size: number }) {
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
      {/* Antenna with signal dot */}
      <path d="M12 6V3" strokeWidth="2.5" />
      <circle cx="12" cy="2" r="1" fill="#000" stroke="none" />

      {/* Chat bubble body - rounded rectangle */}
      <rect x="4" y="6" width="16" height="11" rx="3" strokeWidth="2" />

      {/* Chat bubble tail - bottom left */}
      <path d="M7 17L4 21V17" strokeWidth="2" strokeLinejoin="round" />

      {/* Robot eyes - circles */}
      <circle cx="9" cy="11.5" r="1.5" fill="#000" stroke="none" />
      <circle cx="15" cy="11.5" r="1.5" fill="#000" stroke="none" />

      {/* Side connectors */}
      <path d="M1 11h3" strokeWidth="2" />
      <path d="M20 11h3" strokeWidth="2" />
    </svg>
  )
}

export default function Logo({ size = 32, variant = 'full' }: LogoProps) {
  if (variant === 'icon') {
    return <SetterBotIcon size={size} />
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
      <SetterBotIcon size={size} />
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
