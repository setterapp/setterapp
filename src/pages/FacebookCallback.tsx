import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { facebookOAuthService } from '../services/facebook-oauth'

function FacebookCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  // Check immediately if we're in a popup
  const [isPopup] = useState(() => {
    return !!(window.opener && !window.opener.closed)
  })

  useEffect(() => {
    const handleFacebookCallback = async () => {
      try {
        // Get authorization code and state from URL
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const errorParam = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        // Check for errors from Facebook
        if (errorParam) {
          console.error('❌ Error from Facebook:', errorParam, errorDescription)
          setError(errorDescription || errorParam || 'Error al autorizar con Facebook')
          setTimeout(() => navigate('/integrations'), 5000)
          return
        }

        // Verify state (CSRF protection)
        const storedState = localStorage.getItem('facebook_oauth_state')
        const storedUserId = localStorage.getItem('facebook_oauth_user_id')

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

        console.log('🔵 Intercambiando código de Facebook por Page Access Token...')

        // Exchange code for Page Access Token
        const pageData = await facebookOAuthService.exchangeCodeForPageToken(code)

        console.log('✅ Page Access Token obtenido:', {
          pageId: pageData.pageId,
          instagramUsername: pageData.instagramUsername
        })

        // Create Facebook integration with Page Access Token
        await facebookOAuthService.createFacebookIntegration(storedUserId, pageData)

        // Clean up local storage
        localStorage.removeItem('facebook_oauth_state')
        localStorage.removeItem('facebook_oauth_user_id')

        console.log('✅ Integración de Facebook completada')

        // If we're in a popup, notify parent and close
        if (isPopup) {
          try {
            window.opener?.postMessage({
              type: 'facebook_oauth_success',
              code,
              url: window.location.href,
              state,
              completed: true,
            }, window.location.origin)
          } catch {
            // ignore
          }
          setTimeout(() => window.close(), 200)
          return
        }

        // Redirect to integrations page (non-popup)
        navigate('/integrations')
      } catch (err: any) {
        console.error('❌ Error in Facebook callback:', err)
        // If we're in a popup, report the error to opener
        if (isPopup) {
          try {
            window.opener?.postMessage({
              type: 'facebook_oauth_error',
              error: err?.message || 'Error al completar la conexión con Facebook',
            }, window.location.origin)
          } catch {
            // ignore
          }
          setTimeout(() => window.close(), 200)
          return
        }

        setError(err.message || 'Error al completar la conexión con Facebook')
        setTimeout(() => navigate('/integrations'), 5000)
      }
    }

    handleFacebookCallback()
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
        <p>Completando conexión con Facebook...</p>
      </div>
    </div>
  )
}

export default FacebookCallback
