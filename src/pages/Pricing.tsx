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
      {/* Gradient animation keyframes */}
      <style>
        {`
          @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            25% { background-position: 50% 100%; }
            50% { background-position: 100% 50%; }
            75% { background-position: 50% 0%; }
            100% { background-position: 0% 50%; }
          }
        `}
      </style>

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
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
              gap: 'var(--spacing-xl)',
              alignItems: 'stretch',
            }}
          >
            {/* Starter Plan */}
            <div
              style={{
                position: 'relative',
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
                padding: 'var(--spacing-xl)',
                borderRadius: '20px',
                border: '3px solid #000',
                boxShadow: '6px 6px 0px 0px #000',
              }}
            >
              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: '0 0 8px 0', color: '#000' }}>
                  Starter
                </h3>
                <p style={{ margin: '0', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1, color: '#000' }}>$49</span>
                  <span style={{ color: '#666', fontSize: 'var(--font-size-sm)' }}>/month</span>
                </p>
                <p style={{ margin: '8px 0 0 0', fontSize: 'var(--font-size-sm)', color: '#666' }}>
                  Perfect for getting started
                </p>
              </div>

              <div style={{ flex: 1, marginBottom: 'var(--spacing-lg)' }}>
                {[
                  "1 AI Agent",
                  "2,000 messages/month",
                  "1 Knowledge Base",
                  "1 team member",
                  "Instagram DM automation",
                  "Unlimited Comment-to-DM automations",
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
                      color: '#000',
                    }}
                  >
                    <Check size={16} color="#10b981" strokeWidth={3} style={{ flexShrink: 0 }} />
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
                  background: '#000',
                  color: '#fff',
                  border: '2px solid #000',
                  fontWeight: 700,
                  padding: '14px 24px',
                  textDecoration: 'none',
                }}
              >
                Get Started
              </a>
            </div>

            {/* Growth Plan - HIGHLIGHTED */}
            <div
              style={{
                position: 'relative',
                background: 'linear-gradient(45deg, #a5d8ff, #c4b5fd, #fcc2d7, #a5d8ff)',
                backgroundSize: '300% 300%',
                animation: 'gradientShift 4s ease infinite',
                display: 'flex',
                flexDirection: 'column',
                padding: 'var(--spacing-xl)',
                borderRadius: '20px',
                border: '3px solid #000',
                boxShadow: '8px 8px 0px 0px #000',
                transform: 'scale(1.03)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-16px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#000',
                  color: '#fff',
                  padding: '8px 24px',
                  borderRadius: '30px',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap',
                }}
              >
                MOST POPULAR
              </div>

              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: '0 0 8px 0', color: '#000' }}>
                  Growth
                </h3>
                <p style={{ margin: '0', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1, color: '#000' }}>$99</span>
                  <span style={{ color: '#333', fontSize: 'var(--font-size-sm)' }}>/month</span>
                </p>
                <p style={{ margin: '8px 0 0 0', fontSize: 'var(--font-size-sm)', color: '#333' }}>
                  Best for growing businesses
                </p>
              </div>

              <div style={{ flex: 1, marginBottom: 'var(--spacing-lg)' }}>
                {[
                  "3 AI Agents",
                  "10,000 messages/month",
                  "3 Knowledge Bases",
                  "3 team members",
                  "Instagram DM automation",
                  "Unlimited Comment-to-DM automations",
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
                      color: '#000',
                      fontWeight: 500,
                    }}
                  >
                    <Check size={16} color="#000" strokeWidth={3} style={{ flexShrink: 0 }} />
                    {feature}
                  </div>
                ))}
              </div>

              <a
                href={PAYMENT_LINKS.growth}
                className="btn"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  background: '#000',
                  color: '#fff',
                  border: '2px solid #000',
                  fontWeight: 700,
                  padding: '14px 24px',
                  textDecoration: 'none',
                }}
              >
                Get Started
              </a>
            </div>

            {/* Premium Plan */}
            <div
              style={{
                position: 'relative',
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
                padding: 'var(--spacing-xl)',
                borderRadius: '20px',
                border: '3px solid #000',
                boxShadow: '6px 6px 0px 0px #000',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-16px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#a6e3a1',
                  color: '#000',
                  padding: '8px 24px',
                  borderRadius: '30px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: '2px solid #000',
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap',
                }}
              >
                BEST VALUE
              </div>

              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: '0 0 8px 0', color: '#000' }}>
                  Premium
                </h3>
                <p style={{ margin: '0', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1, color: '#000' }}>$347</span>
                  <span style={{ color: '#666', fontSize: 'var(--font-size-sm)' }}>/month</span>
                </p>
                <p style={{ margin: '8px 0 0 0', fontSize: 'var(--font-size-sm)', color: '#666' }}>
                  For high-volume teams
                </p>
              </div>

              <div style={{ flex: 1, marginBottom: 'var(--spacing-lg)' }}>
                {[
                  "10 AI Agents",
                  "Unlimited messages",
                  "10 Knowledge Bases",
                  "10 team members",
                  "Instagram DM automation",
                  "Unlimited Comment-to-DM automations",
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
                      color: '#000',
                    }}
                  >
                    <Check size={16} color="#10b981" strokeWidth={3} style={{ flexShrink: 0 }} />
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
                  background: '#000',
                  color: '#fff',
                  border: '2px solid #000',
                  fontWeight: 700,
                  padding: '14px 24px',
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
