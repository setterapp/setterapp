import { Link, useSearchParams } from 'react-router-dom'

function DeletionStatus() {
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code')

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg-secondary)',
      padding: 'var(--spacing-xl)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        background: 'var(--color-bg)',
        borderRadius: 'var(--border-radius-lg)',
        padding: 'var(--spacing-2xl)',
        border: '2px solid #000',
        textAlign: 'center'
      }}>
        <h1 style={{ margin: 0, marginBottom: 'var(--spacing-lg)', color: 'var(--color-text)' }}>
          Data Deletion Status
        </h1>

        {code ? (
          <>
            <div style={{
              background: 'rgba(166, 227, 161, 0.1)',
              border: '2px solid #000',
              borderRadius: 'var(--border-radius)',
              padding: 'var(--spacing-lg)',
              marginBottom: 'var(--spacing-lg)'
            }}>
              <p style={{ margin: 0, color: 'var(--color-text)', fontWeight: 600 }}>
                Your data deletion request has been processed.
              </p>
            </div>

            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-md)' }}>
              Confirmation Code:
            </p>
            <code style={{
              display: 'block',
              background: 'var(--color-bg-secondary)',
              padding: 'var(--spacing-md)',
              borderRadius: 'var(--border-radius)',
              fontFamily: 'monospace',
              fontSize: 'var(--font-size-sm)',
              wordBreak: 'break-all',
              marginBottom: 'var(--spacing-lg)'
            }}>
              {code}
            </code>

            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              All data associated with your Meta account has been deleted from our systems.
              This includes conversations, messages, and contact information.
            </p>
          </>
        ) : (
          <p style={{ color: 'var(--color-text-secondary)' }}>
            No deletion code provided. If you requested data deletion through Facebook or Instagram,
            please use the link provided in your confirmation.
          </p>
        )}

        <div style={{ marginTop: 'var(--spacing-xl)' }}>
          <Link
            to="/"
            style={{
              color: 'var(--color-primary)',
              textDecoration: 'none',
              fontSize: 'var(--font-size-sm)'
            }}
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default DeletionStatus
