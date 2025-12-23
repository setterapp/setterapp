interface GoogleCalendarIconProps {
  size?: number
  color?: string
}

export default function GoogleCalendarIcon({ size = 24, color = '#fff' }: GoogleCalendarIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Calendar body - filled */}
      <rect
        x="4"
        y="6"
        width="16"
        height="15"
        rx="2"
        fill={color}
      />
      {/* Top bar - darker */}
      <rect
        x="4"
        y="6"
        width="16"
        height="4"
        rx="2"
        fill={color}
        opacity="0.8"
      />
      {/* Calendar rings */}
      <rect
        x="7"
        y="3"
        width="2"
        height="5"
        rx="1"
        fill={color}
      />
      <rect
        x="15"
        y="3"
        width="2"
        height="5"
        rx="1"
        fill={color}
      />
      {/* Grid dots - using darker color for contrast */}
      <circle cx="8" cy="13" r="1.5" fill="#4285F4" />
      <circle cx="12" cy="13" r="1.5" fill="#4285F4" />
      <circle cx="16" cy="13" r="1.5" fill="#4285F4" />
      <circle cx="8" cy="17" r="1.5" fill="#4285F4" />
      <circle cx="12" cy="17" r="1.5" fill="#4285F4" />
      <circle cx="16" cy="17" r="1.5" fill="#4285F4" />
    </svg>
  )
}









