import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { instagramDirectService } from '../services/instagram-direct'

function InstagramCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  // Check immediately if we're in a popup (window.opener can be null due to cross-origin)
  const [isPopup] = useState(() => {
    // Check multiple indicators that we're in a popup
    const hasOpener = !!(window.opener && !window.opener.closed)
    const isSmallWindow = window.innerWidth < 700 && window.innerHeight < 800
    const hasStoredState = !!localStorage.getItem('instagram_oauth_state')
    return hasOpener || (isSmallWindow && hasStoredState)
  })

  useEffect(() => {
    const handleInstagramCallback = async () => {
      try {
        // Get authorization code and state from URL
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const errorParam = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        // If we're in a popup, try multiple methods to communicate with parent
        if (isPopup) {
          try {
            // Method 1: Try postMessage if opener exists
            if (window.opener && !window.opener.closed) {
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
            }

            // Method 2: Always store in localStorage as fallback
            // The parent window polls localStorage for this
            if (errorParam) {
              localStorage.setItem('instagram_oauth_result', JSON.stringify({
                type: 'error',
                error: errorDescription || errorParam,
                timestamp: Date.now()
              }))
            } else if (code) {
              localStorage.setItem('instagram_oauth_result', JSON.stringify({
                type: 'success',
                code: code,
                url: window.location.href,
                state: state,
                timestamp: Date.now()
              }))
            }

            // Close popup - use setTimeout to ensure storage is written
            setTimeout(() => {
              window.close()
              if (!window.closed) {
                window.close()
              }
            }, 300)
            return
          } catch (e) {
            console.error('Error in popup callback:', e)
            // Still try localStorage fallback
            if (code) {
              localStorage.setItem('instagram_oauth_result', JSON.stringify({
                type: 'success',
                code: code,
                url: window.location.href,
                state: state,
                timestamp: Date.now()
              }))
            }
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
        // CRITICAL: instagram_business_account_id is needed for webhook message routing
        await instagramDirectService.storeAccessToken(
          storedUserId,
          tokenData.access_token,
          {
            user_id: tokenData.user_id,
            username: tokenData.username,
            instagram_business_account_id: tokenData.instagram_business_account_id,
            expires_in: tokenData.expires_in,
            token_type: tokenData.token_type,
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
