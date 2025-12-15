import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { instagramDirectService } from '../services/instagram-direct'

function InstagramCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleInstagramCallback = async () => {
      try {
        // Get authorization code and state from URL
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const errorParam = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        // If we're in a popup, send message to parent window and close immediately
        if (window.opener && !window.opener.closed) {
          try {
            if (errorParam) {
              window.opener.postMessage({
                type: 'instagram_oauth_error',
                error: errorDescription || errorParam
              }, window.location.origin)
            } else if (code) {
              window.opener.postMessage({
                type: 'instagram_oauth_success',
                code: code,
                url: window.location.href,
                state: state
              }, window.location.origin)
            }
            // Close popup immediately after sending message
            window.close()
            return
          } catch (e) {
            console.error('Error sending message to parent:', e)
            // Still try to close the popup
            window.close()
            return
          }
        }

        // Check for errors from Instagram
        if (errorParam) {
          console.error('❌ Error from Instagram:', errorParam, errorDescription)
          setError(errorDescription || errorParam || 'Error al autorizar con Instagram')
          setTimeout(() => navigate('/integrations'), 5000)
          return
        }

        // Verify state (CSRF protection)
        const storedState = sessionStorage.getItem('instagram_oauth_state')
        const storedUserId = sessionStorage.getItem('instagram_oauth_user_id')

        if (!state || state !== storedState) {
          console.error('❌ Invalid state parameter')
          setError('Solicitud inválida. Por favor, intenta de nuevo.')
          setTimeout(() => navigate('/integrations'), 5000)
          return
        }

        if (!code) {
          console.error('❌ No authorization code received')
          setError('No se recibió código de autorización')
          setTimeout(() => navigate('/integrations'), 5000)
          return
        }

        if (!storedUserId) {
          console.error('❌ No user ID found in session')
          setError('Sesión no encontrada. Por favor, inicia sesión de nuevo.')
          setTimeout(() => navigate('/login'), 5000)
          return
        }

        console.log('✅ Instagram callback recibido:', {
          code: code.substring(0, 20) + '...',
          state,
          userId: storedUserId
        })

        // Exchange code for access token
        console.log('🔄 Intercambiando código por token...')
        const tokenData = await instagramDirectService.exchangeCodeForToken(code)

        console.log('✅ Token obtenido:', {
          access_token: tokenData.access_token ? '***' : 'none',
          user_id: tokenData.user_id
        })

        // Store access token in user's integration
        console.log('💾 Guardando token en integración...')
        await instagramDirectService.storeAccessToken(
          storedUserId,
          tokenData.access_token,
          {
            user_id: tokenData.user_id,
            username: tokenData.username,
          }
        )

        // Clean up session storage
        sessionStorage.removeItem('instagram_oauth_state')
        sessionStorage.removeItem('instagram_oauth_user_id')

        console.log('✅ Instagram conectado exitosamente')

        // Redirect to integrations page
        navigate('/integrations')
      } catch (err: any) {
        console.error('❌ Error en Instagram callback:', err)
        setError(err.message || 'Error al completar la conexión con Instagram')
        setTimeout(() => navigate('/integrations'), 5000)
      }
    }

    handleInstagramCallback()
  }, [navigate, searchParams])

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
          <h3 style={{ color: 'var(--color-danger)' }}>Error de conexión</h3>
          <p className="text-secondary">{error}</p>
          <p className="text-tertiary text-sm">Redirigiendo...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
        <p>Completando conexión con Instagram...</p>
      </div>
    </div>
  )
}

export default InstagramCallback

