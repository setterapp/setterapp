import * as React from "react"

interface SwitchProps {
  id?: string
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ id, checked = false, onCheckedChange, disabled = false }, ref) => {
    return (
      <button
        ref={ref}
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onCheckedChange?.(!checked)}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          width: '44px',
          height: '24px',
          padding: 0,
          border: '2px solid #000',
          borderRadius: '9999px',
          backgroundColor: checked ? '#22c55e' : '#d1d5db',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'background-color 0.2s',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            width: '16px',
            height: '16px',
            left: checked ? '24px' : '2px',
            backgroundColor: '#fff',
            border: '2px solid #000',
            borderRadius: '9999px',
            transition: 'left 0.2s',
          }}
        />
      </button>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }
