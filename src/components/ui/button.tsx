import * as React from "react"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', style, ...props }, ref) => {
    const baseStyles: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--spacing-sm)',
      padding: size === 'sm' ? 'var(--spacing-xs) var(--spacing-sm)' :
               size === 'lg' ? 'var(--spacing-md) var(--spacing-lg)' :
               'var(--spacing-sm) var(--spacing-md)',
      fontSize: size === 'sm' ? 'var(--font-size-sm)' :
                size === 'lg' ? 'var(--font-size-lg)' :
                'var(--font-size-base)',
      fontWeight: 600,
      borderRadius: 'var(--border-radius-sm)',
      border: '2px solid #000',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      position: 'relative',
      boxShadow: 'none',
      background: variant === 'secondary' ? 'var(--color-bg-secondary)' :
                  variant === 'ghost' ? 'transparent' :
                  'var(--color-primary)',
      color: variant === 'ghost' ? 'var(--color-text)' : '#000',
    }

    return (
      <button
        ref={ref}
        className={className}
        style={{
          ...baseStyles,
          ...style,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '3px 3px 0px 0px #000'
        }}
        onMouseLeave={(e) => {
          if (!e.currentTarget.matches(':active')) {
            e.currentTarget.style.boxShadow = 'none'
            e.currentTarget.style.transform = 'translate(0, 0)'
          }
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = 'translate(3px, 3px)'
          e.currentTarget.style.boxShadow = 'none'
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'translate(0, 0)'
          e.currentTarget.style.boxShadow = '3px 3px 0px 0px #000'
        }}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
