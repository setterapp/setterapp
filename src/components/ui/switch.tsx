import * as React from "react"

interface SwitchProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
}

const Switch = React.forwardRef<HTMLLabelElement, SwitchProps>(
  ({ checked = false, onCheckedChange, disabled = false, className, style, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={className}
        style={{
          position: 'relative',
          display: 'inline-block',
          width: '52px',
          height: '28px',
          margin: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          ...style,
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          disabled={disabled}
          style={{
            opacity: 0,
            width: 0,
            height: 0,
          }}
        />
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: checked ? 'var(--color-primary)' : 'var(--color-border)',
            borderRadius: '28px',
            transition: 'var(--transition)',
          }}
        >
          <span
            style={{
              position: 'absolute',
              content: '""',
              height: '22px',
              width: '22px',
              left: checked ? '26px' : '3px',
              bottom: '3px',
              backgroundColor: 'var(--color-bg)',
              borderRadius: '50%',
              transition: 'var(--transition)',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.4)',
            }}
          />
        </span>
      </label>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }
