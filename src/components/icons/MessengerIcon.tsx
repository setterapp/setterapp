import type { ComponentProps } from 'react'

type Props = {
  size?: number
  color?: string
} & Omit<ComponentProps<'svg'>, 'color'>

export default function MessengerIcon({ size = 24, color = '#000', ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...rest}
    >
      <path
        d="M12 3C6.82 3 2.7 6.94 2.7 11.8c0 2.77 1.3 5.22 3.42 6.83v2.37c0 .36.39.58.7.38l2.62-1.68c.8.22 1.66.34 2.56.34 5.18 0 9.3-3.94 9.3-8.8S17.18 3 12 3Z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M7.8 13.5l3.3-3.3 2.2 2.2 3.0-3.0"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
