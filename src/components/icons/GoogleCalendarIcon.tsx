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
      {/* Calendar outline */}
      <rect
        x="4"
        y="5"
        width="16"
        height="16"
        rx="2"
        stroke={color}
        strokeWidth="2"
        fill="none"
      />
      {/* Top bar */}
      <line
        x1="4"
        y1="9"
        x2="20"
        y2="9"
        stroke={color}
        strokeWidth="2"
      />
      {/* Calendar rings */}
      <line
        x1="8"
        y1="3"
        x2="8"
        y2="7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="3"
        x2="16"
        y2="7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Date dots */}
      <circle cx="8" cy="13" r="1" fill={color} />
      <circle cx="12" cy="13" r="1" fill={color} />
      <circle cx="16" cy="13" r="1" fill={color} />
      <circle cx="8" cy="17" r="1" fill={color} />
      <circle cx="12" cy="17" r="1" fill={color} />
    </svg>
  )
}









