import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brain, Mail, Lock, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import GoogleIcon from '../components/icons/GoogleIcon'

function Register() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirigir si ya está autenticado
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/analytics')
      }
    })
  }, [navigate])

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      // Si el registro es exitoso, verificar si necesita permisos de Calendar
      // (esto se hará después de que confirme el email si es necesario)
      // Por ahora, redirigir al login
      navigate('/login')
    } catch (err: any) {
      setError(err.message || 'Error inesperado')
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect_to=/analytics`,
        },
      })

      if (error) {
        setError(error.message)
        setLoading(false)
      }
    } catch (err: any) {
      setError(err.message || 'Error inesperado')
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--spacing-lg)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
              textDecoration: 'none',
              marginBottom: 'var(--spacing-md)',
            }}
          >
            <Brain size={40} color="var(--color-primary)" />
            <h1
              style={{
                margin: 0,
                fontSize: 'var(--font-size-xl)',
                fontWeight: 700,
                color: 'var(--color-text)',
              }}
            >
              AppSetter
            </h1>
          </Link>
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--font-size-xl)',
              fontWeight: 600,
              color: 'var(--color-text)',
            }}
          >
            Crear cuenta
          </h2>
          <p style={{ margin: 'var(--spacing-sm) 0 0 0', color: 'var(--color-text-secondary)' }}>
            Comienza a automatizar tus conversaciones
          </p>
        </div>

        {/* Form Card */}
        <div className="card" style={{ padding: 'var(--spacing-xl)' }}>
          {error && (
            <div
              style={{
                padding: 'var(--spacing-md)',
                background: 'var(--color-danger)',
                color: 'white',
                borderRadius: 'var(--border-radius)',
                marginBottom: 'var(--spacing-md)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              {error}
            </div>
          )}

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="btn btn--secondary"
            style={{
              width: '100%',
              marginBottom: 'var(--spacing-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--spacing-sm)',
            }}
          >
            <GoogleIcon size={20} />
            Continuar con Google
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-md)',
              margin: 'var(--spacing-lg) 0',
            }}
          >
            <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
            <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>o</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailRegister}>
            <div className="form-group">
              <label htmlFor="name" className="label">
                Nombre
              </label>
              <div style={{ position: 'relative' }}>
                <User
                  size={20}
                  style={{
                    position: 'absolute',
                    left: 'var(--spacing-md)',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-text-secondary)',
                  }}
                />
                <input
                  id="name"
                  type="text"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Tu nombre"
                  style={{ paddingLeft: 'calc(var(--spacing-md) * 2 + 20px)' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email" className="label">
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={20}
                  style={{
                    position: 'absolute',
                    left: 'var(--spacing-md)',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-text-secondary)',
                  }}
                />
                <input
                  id="email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="tu@email.com"
                  style={{ paddingLeft: 'calc(var(--spacing-md) * 2 + 20px)' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password" className="label">
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={20}
                  style={{
                    position: 'absolute',
                    left: 'var(--spacing-md)',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-text-secondary)',
                  }}
                />
                <input
                  id="password"
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  minLength={6}
                  style={{ paddingLeft: 'calc(var(--spacing-md) * 2 + 20px)' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="label">
                Confirmar contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={20}
                  style={{
                    position: 'absolute',
                    left: 'var(--spacing-md)',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-text-secondary)',
                  }}
                />
                <input
                  id="confirmPassword"
                  type="password"
                  className="input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  minLength={6}
                  style={{ paddingLeft: 'calc(var(--spacing-md) * 2 + 20px)' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn--primary"
              style={{ width: '100%', marginTop: 'var(--spacing-md)' }}
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          <div style={{ marginTop: 'var(--spacing-lg)', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              ¿Ya tienes una cuenta?{' '}
              <Link to="/login" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register
