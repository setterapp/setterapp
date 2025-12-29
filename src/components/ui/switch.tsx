import * as React from "react"

interface SwitchProps {
  id?: string
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ id, checked = false, onCheckedChange, disabled = false, className, style }, ref) => {
    return (
      <button
        ref={ref}
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={className}
        onClick={() => !disabled && onCheckedChange?.(!checked)}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          width: '44px',
          height: '24px',
          padding: 0,
          margin: 0,
          border: '2px solid #000',
          borderRadius: '24px',
          backgroundColor: checked ? '#22c55e' : '#e5e5e5',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'background-color 0.2s ease',
          flexShrink: 0,
          ...style,
        }}
      >
        <span
          style={{
            position: 'absolute',
            width: '18px',
            height: '18px',
            left: checked ? '22px' : '2px',
            backgroundColor: '#fff',
            border: '2px solid #000',
            borderRadius: '50%',
            transition: 'left 0.2s ease',
          }}
        />
      </button>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }
