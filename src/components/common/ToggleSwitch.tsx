interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export default function ToggleSwitch({ checked, onChange, disabled = false }: ToggleSwitchProps) {
  return (
    <label
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '52px',
        height: '28px',
        margin: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
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
          backgroundColor: checked ? 'var(--color-primary-hover)' : 'var(--color-border)',
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
