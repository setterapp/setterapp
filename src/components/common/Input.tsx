interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  type?: 'text' | 'password' | 'email' | 'number' | 'textarea' | 'select'
  className?: string
  children?: React.ReactNode
}

export default function Input({
  label,
  error,
  type = 'text',
  className = '',
  children,
  ...props
}: InputProps) {
  const inputClass = error ? 'input input--error' : 'input'

  return (
    <div className={className}>
      {label && (
        <label className="label">
          {label}
        </label>
      )}

      {type === 'textarea' ? (
        <textarea
          className={`${inputClass} textarea`}
          {...(props as any)}
        />
      ) : type === 'select' ? (
        <select
          className={`${inputClass} select`}
          {...(props as any)}
        >
          {children}
        </select>
      ) : (
        <input
          type={type}
          className={inputClass}
          {...props}
        />
      )}

      {error && (
        <p className="text-sm mt-xs" style={{ color: 'var(--color-danger)' }}>
          {error}
        </p>
      )}
    </div>
  )
}










