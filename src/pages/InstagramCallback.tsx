import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { instagramDirectService } from '../services/instagram-direct'

function InstagramCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  // Check immediately if we're in a popup
  const [isPopup] = useState(() => {
    return !!(window.opener && !window.opener.closed)
  })

  useEffect(() => {
    const handleInstagramCallback = async () => {
      try {
        // Get authorization code and state from URL
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const errorParam = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        // If we're in a popup, send message to parent window and close immediately
        // Check for popup BEFORE doing anything else
        if (isPopup) {
          try {
            // Small delay to ensure message is sent
            await new Promise(resolve => setTimeout(resolve, 100))

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

            // Close popup immediately - use setTimeout to ensure message is sent first
            setTimeout(() => {
              window.close()
              // Force close if still open
              if (!window.closed) {
                window.close()
              }
            }, 200)
            return
          } catch (e) {
            console.error('Error sending message to parent:', e)
            // Still try to close the popup
            setTimeout(() => {
              window.close()
              if (!window.closed) {
                window.close()
              }
            }, 100)
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
        const storedState = localStorage.getItem('instagram_oauth_state')
        const storedUserId = localStorage.getItem('instagram_oauth_user_id')

        if (!state || state !== storedState) {
          setError('Solicitud inválida. Por favor, intenta de nuevo.')
          setTimeout(() => navigate('/integrations'), 5000)
          return
        }

        if (!code) {
          setError('No se recibió código de autorización')
          setTimeout(() => navigate('/integrations'), 5000)
          return
        }

        if (!storedUserId) {
          setError('Sesión no encontrada. Por favor, inicia sesión de nuevo.')
          setTimeout(() => navigate('/login'), 5000)
          return
        }

        // Exchange code for access token
        const tokenData = await instagramDirectService.exchangeCodeForToken(code)

        // Store access token in user's integration
        await instagramDirectService.storeAccessToken(
          storedUserId,
          tokenData.access_token,
          {
            user_id: tokenData.user_id,
            username: tokenData.username,
          }
        )

        // Clean up local storage
        localStorage.removeItem('instagram_oauth_state')
        localStorage.removeItem('instagram_oauth_user_id')

        // Redirect to integrations page
        navigate('/integrations')
      } catch (err: any) {
        setError(err.message || 'Error al completar la conexión con Instagram')
        setTimeout(() => navigate('/integrations'), 5000)
      }
    }

    handleInstagramCallback()
  }, [navigate, searchParams, isPopup])

  // If we're in a popup, don't render anything - just close it
  if (isPopup) {
    return null
  }

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
