import { Check } from 'lucide-react'
import { useSubscription, type SubscriptionPlan } from '../hooks/useSubscription'

interface PaywallProps {
  onClose?: () => void
}

export default function Paywall({ onClose }: PaywallProps) {
  const { createCheckout, loading } = useSubscription()

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    try {
      await createCheckout(plan)
    } catch (error) {
      console.error('Failed to create checkout:', error)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 'var(--spacing-lg)',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 'var(--border-radius-lg)',
          border: '3px solid #000',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 'var(--spacing-2xl)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0 0 var(--spacing-sm) 0' }}>
            Choose Your Plan
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            Subscribe to access all features and start automating your appointments
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 'var(--spacing-lg)',
          }}
        >
          {/* Starter Plan */}
          <div
            className="card"
            style={{
              padding: 'var(--spacing-lg)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: '0 0 4px 0', color: '#666' }}>
              Starter
            </h3>
            <p style={{ margin: '0 0 var(--spacing-md) 0', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1 }}>$5</span>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>/month</span>
            </p>

            <div style={{ flex: 1, marginBottom: 'var(--spacing-md)' }}>
              {[
                "1 AI Agent",
                "2,000 messages/month",
                "1 Knowledge Base",
                "1 team member",
                "Instagram DM automation",
                "Unlimited Comment-to-DM automations",
                "Google Calendar sync",
                "Email support",
              ].map((feature, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: 'var(--font-size-sm)' }}>
                  <Check size={16} color="#10b981" strokeWidth={2.5} />
                  {feature}
                </div>
              ))}
            </div>

            <button
              onClick={() => handleSelectPlan('starter')}
              disabled={loading}
              className="btn"
              style={{
                width: '100%',
                justifyContent: 'center',
                background: '#fff',
                color: '#000',
                border: '2px solid #000',
              }}
            >
              {loading ? 'Loading...' : 'Select Starter'}
            </button>
          </div>

          {/* Growth Plan */}
          <div
            className="card"
            style={{
              padding: 'var(--spacing-lg)',
              display: 'flex',
              flexDirection: 'column',
              border: '3px solid var(--color-primary)',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-12px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--color-primary)',
                color: '#000',
                padding: '4px 16px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 700,
                border: '2px solid #000',
              }}
            >
              MOST POPULAR
            </div>

            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: '0 0 4px 0', color: '#666' }}>
              Growth
            </h3>
            <p style={{ margin: '0 0 var(--spacing-md) 0', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1 }}>$99</span>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>/month</span>
            </p>

            <div style={{ flex: 1, marginBottom: 'var(--spacing-md)' }}>
              {[
                "3 AI Agents",
                "10,000 messages/month",
                "3 Knowledge Bases",
                "3 team members",
                "Instagram DM automation",
                "Unlimited Comment-to-DM automations",
                "Google Calendar sync",
                "Priority support",
              ].map((feature, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: 'var(--font-size-sm)' }}>
                  <Check size={16} color="#10b981" strokeWidth={2.5} />
                  {feature}
                </div>
              ))}
            </div>

            <button
              onClick={() => handleSelectPlan('growth')}
              disabled={loading}
              className="btn btn--primary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {loading ? 'Loading...' : 'Select Growth'}
            </button>
          </div>

          {/* Premium Plan */}
          <div
            className="card"
            style={{
              padding: 'var(--spacing-lg)',
              display: 'flex',
              flexDirection: 'column',
              background: 'linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%)',
              color: '#fff',
            }}
          >
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: '0 0 4px 0', color: 'rgba(255,255,255,0.6)' }}>
              Premium
            </h3>
            <p style={{ margin: '0 0 var(--spacing-md) 0', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1 }}>$347</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'var(--font-size-sm)' }}>/month</span>
            </p>

            <div style={{ flex: 1, marginBottom: 'var(--spacing-md)' }}>
              {[
                "10 AI Agents",
                "Unlimited messages",
                "10 Knowledge Bases",
                "10 team members",
                "Unlimited Comment-to-DM automations",
                "VIP 24/7 support",
                "Personalized onboarding",
                "Early access to features",
              ].map((feature, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: 'var(--font-size-sm)', color: 'rgba(255,255,255,0.85)' }}>
                  <Check size={16} color="#a6e3a1" strokeWidth={2.5} />
                  {feature}
                </div>
              ))}
            </div>

            <button
              onClick={() => handleSelectPlan('premium')}
              disabled={loading}
              className="btn"
              style={{
                width: '100%',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #f9e2af 0%, #f59e0b 100%)',
                color: '#000',
                border: '2px solid #000',
              }}
            >
              {loading ? 'Loading...' : 'Select Premium'}
            </button>
          </div>
        </div>

        {onClose && (
          <div style={{ textAlign: 'center', marginTop: 'var(--spacing-lg)' }}>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              Maybe later
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
