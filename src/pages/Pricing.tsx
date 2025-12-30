import { Check } from 'lucide-react'
import Logo from '../components/Logo'

// Direct Stripe payment links - instant redirect, no server call needed
const PAYMENT_LINKS = {
  starter: 'https://buy.stripe.com/8x27sF5re35D9x7g2OeEo00',
  growth: 'https://buy.stripe.com/14A4gt2f2eOl7oZ3g2eEo01',
  premium: 'https://buy.stripe.com/9B628l5re7lT9x7cQCeEo02',
}

export default function Pricing() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #fafafa 0%, #fff 100%)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: 'var(--spacing-lg) var(--spacing-xl)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <Logo size={40} variant="icon" />
          <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text)' }}>
            setterapp.ai
          </span>
        </div>
      </header>

      {/* Pricing Section */}
      <section
        style={{
          flex: 1,
          padding: '40px var(--spacing-xl) 80px',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h1
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              textAlign: 'center',
              margin: '0 0 var(--spacing-sm) 0',
              color: 'var(--color-text)',
            }}
          >
            Choose Your Plan
          </h1>
          <p
            style={{
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              margin: '0 0 var(--spacing-2xl) 0',
              fontSize: 'var(--font-size-lg)',
            }}
          >
            Subscribe to start automating your appointment booking
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
              gap: 'var(--spacing-xl)',
              alignItems: 'stretch',
            }}
          >
            {/* Starter Plan */}
            <div
              className="card"
              style={{
                position: 'relative',
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
                padding: 'var(--spacing-xl)',
              }}
            >
              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: '0 0 4px 0', color: '#666' }}>
                  Starter
                </h3>
                <p style={{ margin: '0', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1 }}>$49</span>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>/month</span>
                </p>
              </div>

              <div style={{ flex: 1, marginBottom: 'var(--spacing-lg)' }}>
                {[
                  "1 AI Agent",
                  "2,000 messages/month",
                  "1 Knowledge Base",
                  "Instagram DM automation",
                  "Google Calendar sync",
                  "Built-in CRM",
                  "Email support",
                ].map((feature, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-sm)',
                      marginBottom: '12px',
                      fontSize: 'var(--font-size-sm)',
                      color: '#444',
                    }}
                  >
                    <Check size={16} color="#10b981" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                    {feature}
                  </div>
                ))}
              </div>

              <a
                href={PAYMENT_LINKS.starter}
                className="btn"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  background: '#fff',
                  color: '#000',
                  border: '2px solid #000',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Get Started
              </a>
            </div>

            {/* Growth Plan */}
            <div
              className="card"
              style={{
                position: 'relative',
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
                padding: 'var(--spacing-xl)',
                border: '3px solid var(--color-primary)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                transform: 'scale(1.02)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-14px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--color-primary)',
                  color: '#000',
                  padding: '6px 20px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: '2px solid #000',
                  letterSpacing: '0.5px',
                }}
              >
                MOST POPULAR
              </div>

              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: '0 0 4px 0', color: '#666' }}>
                  Growth
                </h3>
                <p style={{ margin: '0', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1 }}>$99</span>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>/month</span>
                </p>
              </div>

              <div style={{ flex: 1, marginBottom: 'var(--spacing-lg)' }}>
                {[
                  "3 AI Agents",
                  "10,000 messages/month",
                  "3 Knowledge Bases",
                  "Instagram DM automation",
                  "Google Calendar sync",
                  "Built-in CRM",
                  "Priority support",
                ].map((feature, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-sm)',
                      marginBottom: '12px',
                      fontSize: 'var(--font-size-sm)',
                      color: '#444',
                    }}
                  >
                    <Check size={16} color="#10b981" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                    {feature}
                  </div>
                ))}
              </div>

              <a
                href={PAYMENT_LINKS.growth}
                className="btn btn--primary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Get Started
              </a>
            </div>

            {/* Premium Plan */}
            <div
              className="card"
              style={{
                position: 'relative',
                background: 'linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%)',
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
                padding: 'var(--spacing-xl)',
                border: '2px solid #333',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-14px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #f9e2af 0%, #f59e0b 100%)',
                  color: '#000',
                  padding: '6px 20px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: '2px solid #000',
                  letterSpacing: '0.5px',
                }}
              >
                BEST VALUE
              </div>

              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: '0 0 4px 0', color: 'rgba(255,255,255,0.6)' }}>
                  Premium
                </h3>
                <p style={{ margin: '0', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1 }}>$347</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'var(--font-size-sm)' }}>/month</span>
                </p>
              </div>

              <div style={{ flex: 1, marginBottom: 'var(--spacing-lg)' }}>
                {[
                  "10 AI Agents",
                  "Unlimited messages",
                  "10 Knowledge Bases",
                  "Instagram DM automation",
                  "Google Calendar sync",
                  "Built-in CRM",
                  "VIP 24/7 support",
                  "Personalized onboarding",
                  "Early access to features",
                ].map((feature, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-sm)',
                      marginBottom: '12px',
                      fontSize: 'var(--font-size-sm)',
                      color: 'rgba(255,255,255,0.85)',
                    }}
                  >
                    <Check size={16} color="#a6e3a1" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                    {feature}
                  </div>
                ))}
              </div>

              <a
                href={PAYMENT_LINKS.premium}
                className="btn"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #f9e2af 0%, #f59e0b 100%)',
                  color: '#000',
                  border: '2px solid #000',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Get Started
              </a>
            </div>
          </div>

          {/* Trust badges */}
          <div
            style={{
              marginTop: 'var(--spacing-2xl)',
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            <p style={{ margin: '0 0 var(--spacing-sm) 0' }}>
              Secure payment powered by Stripe
            </p>
            <p style={{ margin: 0 }}>
              Cancel anytime. No questions asked.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
