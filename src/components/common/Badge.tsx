interface BadgeProps {
  children: React.ReactNode
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'secondary'
  className?: string
}

export default function Badge({ children, variant = 'secondary', className = '' }: BadgeProps) {
  const baseClass = 'badge'
  const variantClass = variant !== 'secondary' ? `badge--${variant}` : 'badge--secondary'

  const classes = [baseClass, variantClass, className]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={classes}>
      {children}
    </span>
  )
}

