import { Link } from 'react-router-dom'

function PrivacyPolicy() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg-secondary)',
      padding: 'var(--spacing-xl)',
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        background: 'var(--color-bg)',
        borderRadius: 'var(--border-radius-lg)',
        padding: 'var(--spacing-2xl)',
        border: '1px solid var(--color-border)',
      }}>
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <Link
            to="/"
            style={{
              color: 'var(--color-primary)',
              textDecoration: 'none',
              fontSize: 'var(--font-size-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)',
              marginBottom: 'var(--spacing-lg)'
            }}
          >
            ← Back to Home
          </Link>
          <h1 style={{ margin: 0, marginBottom: 'var(--spacing-md)', color: 'var(--color-text)' }}>
            Privacy Policy
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div style={{ lineHeight: 1.8, color: 'var(--color-text)' }}>
          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>1. Information We Collect</h2>
            <p>
              At setterapp.ai, we collect and process the following information to provide our services:
            </p>
            <ul style={{ paddingLeft: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>
                <strong>Account information:</strong> Email, username, and authentication data when you sign up.
              </li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>
                <strong>Integration data:</strong> Information from your connected accounts (WhatsApp Business, Instagram, Google Calendar) necessary to provide our services.
              </li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>
                <strong>Conversations and messages:</strong> Messages and conversations managed through our AI agents to enable automation and automatic responses.
              </li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>
                <strong>Agent configuration:</strong> Settings and preferences for your customized AI agents.
              </li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>
                <strong>Usage data:</strong> Information about how you use our platform, including metrics and statistics.
              </li>
            </ul>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>2. How We Use Your Information</h2>
            <p>We use the collected information to:</p>
            <ul style={{ paddingLeft: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Provide, maintain, and improve our services</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Manage and respond to messages automatically through AI agents</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Personalize the user experience</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Send notifications and updates about our services</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Analyze platform usage to improve our services</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Comply with legal obligations and protect our rights</li>
            </ul>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>3. Third-Party Services</h2>
            <p>
              We use the following third-party services that may collect information:
            </p>
            <ul style={{ paddingLeft: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>
                <strong>Supabase:</strong> For authentication, database, and storage. See their privacy policy at{' '}
                <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>
                  https://supabase.com/privacy
                </a>
              </li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>
                <strong>Meta/Facebook:</strong> For WhatsApp Business and Instagram integration. See their privacy policy at{' '}
                <a href="https://www.facebook.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>
                  https://www.facebook.com/privacy
                </a>
              </li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>
                <strong>Google:</strong> For Google Calendar integration. See their privacy policy at{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>
                  https://policies.google.com/privacy
                </a>
              </li>
            </ul>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>4. Data Security</h2>
            <p>
              We implement technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes:
            </p>
            <ul style={{ paddingLeft: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Data encryption in transit and at rest</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Secure authentication and access control</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Regular security monitoring</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Secure storage on trusted third-party infrastructure</li>
            </ul>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>5. Your Rights</h2>
            <p>You have the right to:</p>
            <ul style={{ paddingLeft: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Access your personal information</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Correct inaccurate information</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Request deletion of your data</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Export your data</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Withdraw your consent at any time</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Disconnect integrations at any time from settings</li>
            </ul>
            <p style={{ marginTop: 'var(--spacing-md)' }}>
              To exercise these rights, you can contact us through your account settings or by deleting your account directly.
            </p>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>6. Data Retention</h2>
            <p>
              We retain your personal information for as long as your account is active or as needed to provide our services. When you delete your account, we delete or anonymize your personal information, except where the law requires us to retain it.
            </p>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>7. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy on this page and updating the "Last updated" date. We recommend reviewing this policy periodically.
            </p>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>8. Contact</h2>
            <p>
              If you have questions about this Privacy Policy or how we handle your data, you can contact us through your account on the platform or by visiting{' '}
              <a href="https://setterapp.ai" style={{ color: 'var(--color-primary)' }}>setterapp.ai</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicy
