interface GoogleCalendarIconProps {
  size?: number
  color?: string
}

export default function GoogleCalendarIcon({ size = 24, color = '#000' }: GoogleCalendarIconProps) {
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
        strokeWidth="2.5"
        fill="none"
      />
      {/* Top bar */}
      <line
        x1="4"
        y1="9"
        x2="20"
        y2="9"
        stroke={color}
        strokeWidth="2.5"
      />
      {/* Calendar rings */}
      <rect
        x="7"
        y="3"
        width="2"
        height="4"
        rx="1"
        fill={color}
      />
      <rect
        x="15"
        y="3"
        width="2"
        height="4"
        rx="1"
        fill={color}
      />
      {/* Date number "31" */}
      <text
        x="12"
        y="17"
        fontFamily="Arial, sans-serif"
        fontSize="8"
        fontWeight="bold"
        fill={color}
        textAnchor="middle"
      >
        31
      </text>
    </svg>
  )
}











