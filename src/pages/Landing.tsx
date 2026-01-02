import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  X,
  Calendar,
  Users,
  BarChart3,
  ChevronDown,
  Clock,
  DollarSign,
  TrendingUp
} from 'lucide-react'
import InstagramIcon from '../components/icons/InstagramIcon'
import Logo from '../components/Logo'

// FAQ Accordion Item Component
function FAQItem({ question, answer, isOpen, onClick }: {
  question: string
  answer: string
  isOpen: boolean
  onClick: () => void
}) {
  return (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: 'hidden',
        cursor: 'pointer',
        marginBottom: 'var(--spacing-md)',
      }}
      onClick={onClick}
    >
      <div
        style={{
          padding: 'var(--spacing-lg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: isOpen ? 'var(--color-bg-secondary)' : 'var(--color-bg)',
          transition: 'background 0.2s ease',
        }}
      >
        <h4 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>
          {question}
        </h4>
        <ChevronDown
          size={24}
          style={{
            transition: 'transform 0.3s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0
          }}
        />
      </div>
      <div
        style={{
          maxHeight: isOpen ? '500px' : '0',
          overflow: 'hidden',
          transition: 'max-height 0.3s ease, padding 0.3s ease',
          padding: isOpen ? 'var(--spacing-lg)' : '0 var(--spacing-lg)',
          borderTop: isOpen ? '2px solid #000' : 'none',
        }}
      >
        <p style={{ margin: 0, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          {answer}
        </p>
      </div>
    </div>
  )
}

function Landing() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null)

  const faqs = [
    {
      question: "How does your AI appointment setter work?",
      answer: "Our AI appointment setter uses advanced language models to understand and respond to Instagram DMs naturally. It learns from your business context and can handle appointment booking, answer questions, and qualify leads automatically 24/7."
    },
    {
      question: "What platforms does your AI setter support?",
      answer: "Our AI setter currently supports Instagram DM automation. The AI appointment setter can handle conversations and book appointments around the clock. WhatsApp support is coming soon!"
    },
    {
      question: "Can I customize the AI responses for my business?",
      answer: "Absolutely! You have full control over your AI appointment setter's personality, tone, and responses. You can provide custom instructions, FAQs, and business information to make the automated booking assistant truly yours."
    },
    {
      question: "How does the AI setter integrate with my calendar?",
      answer: "Our AI appointment setter integrates directly with Google Calendar. The AI can check your availability in real-time and book appointments automatically, sending calendar invites with video call links. This automated scheduling works 24/7."
    },
    {
      question: "What happens if the AI doesn't know how to respond?",
      answer: "Our AI appointment setter is smart enough to recognize when it needs human help. It can escalate conversations to you, hold messages for review, or provide a polite response asking the customer to wait for a human response."
    },
    {
      question: "How much does an AI appointment setter cost vs a human setter?",
      answer: "Human setters typically cost $500-2000+ monthly plus 10-30% commissions. Our AI appointment setter starts at just $49/month (Starter plan) with zero commissions, saving you up to 80% while providing 24/7 automated appointment booking. We also offer Growth ($99/mo) and Premium ($347/mo) plans for larger teams."
    }
  ]


  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-secondary)' }}>
      {/* Header */}
      <header
        className="landing-header"
        style={{
          padding: 'var(--spacing-lg) var(--spacing-xl)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--spacing-md)',
          maxWidth: '1400px',
          margin: '0 auto',
        }}
      >
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <Logo size={48} variant="icon" />
          <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text)' }}>
            setterapp.ai
          </span>
        </Link>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/login" className="btn btn--ghost">
            Log In
          </Link>
          <Link to="/register" className="btn btn--primary">
            Get Started
          </Link>
        </div>
      </header>

      {/* 1. HERO SECTION */}
      <section
        className="landing-hero"
        style={{
          padding: '80px var(--spacing-xl)',
          textAlign: 'center',
          maxWidth: '1000px',
          margin: '0 auto',
        }}
      >
        <div
          className="card"
          style={{
            padding: 'var(--spacing-2xl)',
            marginBottom: 'var(--spacing-2xl)',
            animation: 'slideInUp 0.6s ease-out',
            position: 'relative',
          }}
        >
          {/* Floating Badge */}
          <div
            className="hero-badge"
            style={{
              position: 'absolute',
              top: '-12px',
              right: 'clamp(10px, 5%, 20px)',
              background: '#a6e3a1',
              border: '2px solid #000',
              borderRadius: '8px',
              padding: '6px 12px',
              fontWeight: 700,
              fontSize: 'var(--font-size-xs)',
              boxShadow: '2px 2px 0px 0px #000',
              animation: 'floatBadge 3s ease-in-out infinite',
              zIndex: 1,
            }}
          >
            Plans from $49/mo
          </div>

          <div
            style={{
              width: 'clamp(80px, 20vw, 120px)',
              height: 'clamp(80px, 20vw, 120px)',
              background: 'var(--color-primary)',
              border: '2px solid #000',
              borderRadius: '12px',
              margin: '0 auto var(--spacing-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '3px 3px 0px 0px #000',
              animation: 'float 3s ease-in-out infinite',
            }}
          >
            <Logo size={48} variant="icon" />
          </div>

          <h1
            className="landing-hero-title"
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              fontWeight: 700,
              margin: '0 0 var(--spacing-lg) 0',
              color: 'var(--color-text)',
              lineHeight: 1.2,
            }}
          >
            AI Appointment Setter for{' '}
            <span style={{ color: 'var(--color-primary)' }}>Instagram</span>
          </h1>

          <p
            style={{
              fontSize: 'var(--font-size-lg)',
              color: 'var(--color-text-secondary)',
              margin: '0 0 var(--spacing-lg) 0',
              lineHeight: 1.6,
              maxWidth: '700px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            Automate your appointment booking 24/7 with our AI setter. Handle Instagram DMs
            automatically, qualify leads, and book meetings while you sleep.
          </p>

          {/* Meta Technology Partner Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              background: '#ffffff',
              border: '3px solid #000',
              borderRadius: '12px',
              padding: '12px 24px',
              margin: '0 0 var(--spacing-xl) 0',
              boxShadow: '4px 4px 0px 0px #000',
            }}
          >
            {/* Meta Logo */}
            <svg width="32" height="32" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M128 0C57.3 0 0 57.3 0 128s57.3 128 128 128 128-57.3 128-128S198.7 0 128 0zm0 240c-61.8 0-112-50.2-112-112S66.2 16 128 16s112 50.2 112 112-50.2 112-112 112z" fill="#0081FB"/>
              <path d="M128 40c-48.5 0-88 39.5-88 88s39.5 88 88 88 88-39.5 88-88-39.5-88-88-88zm0 160c-39.7 0-72-32.3-72-72s32.3-72 72-72 72 32.3 72 72-32.3 72-72 72z" fill="#0081FB"/>
              <circle cx="128" cy="128" r="48" fill="#0081FB"/>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Official
              </span>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#000', lineHeight: 1 }}>
                Meta Technology Partner
              </span>
            </div>
          </div>

          <div className="landing-hero-buttons" style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" className="btn btn--primary btn--lg" style={{ animation: 'slideInUp 0.8s ease-out' }}>
              Get Started
              <ArrowRight size={20} />
            </Link>
            <Link to="/login" className="btn btn--secondary btn--lg" style={{ animation: 'slideInUp 1s ease-out' }}>
              Log In
            </Link>
          </div>
        </div>
      </section>

      {/* 2. PAIN POINTS SECTION */}
      <section
        style={{
          padding: '60px var(--spacing-xl)',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              textAlign: 'center',
              margin: '0 0 var(--spacing-2xl) 0',
              color: 'var(--color-text)',
            }}
          >
            Tired of This?
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))',
              gap: 'var(--spacing-lg)',
            }}
          >
            {[
              { text: "Paying 10-30% commission per booking", icon: DollarSign },
              { text: "Training setters who leave in 3 months", icon: Users },
              { text: "Losing leads at 3am because no one answers", icon: Clock },
              { text: "Slow responses that cool down hot leads", icon: TrendingUp },
            ].map((pain, index) => (
              <div
                key={index}
                style={{
                  background: '#fff5f5',
                  border: '2px solid #000',
                  borderRadius: '12px',
                  padding: 'var(--spacing-lg)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-md)',
                  animation: `slideInUp 0.5s ease-out`,
                  animationDelay: `${index * 0.1}s`,
                  animationFillMode: 'both',
                  boxShadow: '3px 3px 0px 0px #000',
                  transition: 'transform 0.2s ease',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.animation = 'shake 0.3s ease-in-out'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.animation = ''
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    background: 'var(--color-danger)',
                    border: '2px solid #000',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <X size={24} color="#000" strokeWidth={3} />
                </div>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)' }}>
                  {pain.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. COMPARISON TABLE */}
      <section
        style={{
          padding: '60px var(--spacing-xl)',
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              textAlign: 'center',
              margin: '0 0 var(--spacing-2xl) 0',
              color: 'var(--color-text)',
            }}
          >
            AI vs Human Setter
          </h2>

          <div
            className="card"
            style={{
              overflow: 'auto',
              padding: 0,
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '400px' }}>
              <thead>
                <tr style={{ background: 'var(--color-primary)' }}>
                  <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', borderBottom: '2px solid #000', fontWeight: 700 }}>
                    Aspect
                  </th>
                  <th style={{ padding: 'var(--spacing-md)', textAlign: 'center', borderBottom: '2px solid #000', fontWeight: 700 }}>
                    Human Setter
                  </th>
                  <th style={{ padding: 'var(--spacing-md)', textAlign: 'center', borderBottom: '2px solid #000', fontWeight: 700 }}>
                    SetterApp.ai
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { aspect: "Availability", human: "8-10 hours", ai: "24/7" },
                  { aspect: "Monthly Cost", human: "$500-2000+", ai: "From $49" },
                  { aspect: "Commissions", human: "10-30%", ai: "0%" },
                  { aspect: "Response Time", human: "5-30 min", ai: "Instant" },
                  { aspect: "Training Time", human: "Weeks", ai: "Minutes" },
                  { aspect: "Turnover", human: "High", ai: "None" },
                ].map((row, index) => (
                  <tr key={index} style={{ borderBottom: index < 5 ? '1px solid #e0e0e0' : 'none' }}>
                    <td style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>
                      {row.aspect}
                    </td>
                    <td style={{ padding: 'var(--spacing-md)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                      {row.human}
                    </td>
                    <td style={{
                      padding: 'var(--spacing-md)',
                      textAlign: 'center',
                      background: '#e8f5e9',
                      fontWeight: 600,
                      color: 'var(--color-success)'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <Check size={16} strokeWidth={3} />
                        {row.ai}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 5. FEATURES SECTION */}
      <section
        className="landing-features"
        style={{
          padding: '60px var(--spacing-xl)',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2
            className="landing-section-title"
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              textAlign: 'center',
              margin: '0 0 var(--spacing-2xl) 0',
              color: 'var(--color-text)',
            }}
          >
            AI Appointment Setter Features
          </h2>

          <div
            className="landing-features-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
              gap: 'var(--spacing-lg)',
            }}
          >
            {[
              { icon: InstagramIcon, title: "Instagram DM Automation", desc: "AI appointment setter for Instagram - handle DMs and schedule meetings automatically", color: "#f38ba8", isComponent: true },
              { icon: Calendar, title: "Automated Appointment Booking", desc: "Integrates with Google Calendar to book appointments automatically in real-time", color: "#89b4fa" },
              { icon: Users, title: "AI Lead Qualification", desc: "Automatically qualify leads and track contacts with built-in CRM", color: "#cba6f7" },
              { icon: BarChart3, title: "Conversion Analytics", desc: "Monitor AI setter performance, response times, and booking conversion rates", color: "#f9e2af" },
            ].map((feature, index) => (
              <div
                key={index}
                className="card card--hover"
                style={{
                  padding: 'var(--spacing-2xl)',
                  textAlign: 'center',
                  animation: 'slideInUp 0.6s ease-out',
                  animationDelay: `${index * 0.1}s`,
                  animationFillMode: 'both',
                }}
              >
                <div
                  style={{
                    width: 'clamp(60px, 15vw, 80px)',
                    height: 'clamp(60px, 15vw, 80px)',
                    borderRadius: '12px',
                    background: feature.color,
                    border: '2px solid #000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto var(--spacing-md)',
                    boxShadow: '3px 3px 0px 0px #000',
                  }}
                >
                  {feature.isComponent ? (
                    <feature.icon size={32} color="#000" />
                  ) : (
                    <feature.icon size={32} color="#000" strokeWidth={2} />
                  )}
                </div>
                <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, margin: '0 0 var(--spacing-sm) 0' }}>
                  {feature.title}
                </h4>
                <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. PRICING */}
      <section
        style={{
          padding: '80px var(--spacing-xl)',
          background: 'linear-gradient(180deg, #fafafa 0%, #fff 100%)',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              textAlign: 'center',
              margin: '0 0 var(--spacing-sm) 0',
              color: 'var(--color-text)',
            }}
          >
            Simple, Transparent Pricing
          </h2>
          <p
            style={{
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              margin: '0 0 var(--spacing-2xl) 0',
              fontSize: 'var(--font-size-lg)',
            }}
          >
            Choose the plan that fits your business
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

              {/* Features */}
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

              <Link
                to="/register"
                className="btn"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  background: '#fff',
                  color: '#000',
                  border: '2px solid #000',
                  fontWeight: 600,
                }}
              >
                Get Started
              </Link>
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

              {/* Features */}
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

              <Link
                to="/register"
                className="btn btn--primary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  fontWeight: 600,
                }}
              >
                Get Started
              </Link>
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

              {/* Features */}
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

              <Link
                to="/register"
                className="btn"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #f9e2af 0%, #f59e0b 100%)',
                  color: '#000',
                  border: '2px solid #000',
                  fontWeight: 600,
                }}
              >
                Get Started
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* 10. FAQ */}
      <section
        style={{
          padding: '60px var(--spacing-xl)',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              textAlign: 'center',
              margin: '0 0 var(--spacing-2xl) 0',
              color: 'var(--color-text)',
            }}
          >
            Frequently Asked Questions
          </h2>

          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              question={faq.question}
              answer={faq.answer}
              isOpen={openFAQ === index}
              onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
            />
          ))}
        </div>
      </section>

      {/* 11. FINAL CTA */}
      <section
        className="landing-cta"
        style={{
          padding: '80px var(--spacing-xl)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div
            style={{
              display: 'inline-block',
              background: 'var(--color-success)',
              color: '#000',
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 700,
              marginBottom: 'var(--spacing-lg)',
              border: '2px solid #000',
            }}
          >
            Plans from $49/mo
          </div>
          <h2
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              margin: '0 0 var(--spacing-md) 0',
              color: 'var(--color-text)',
            }}
          >
            Ready to Automate Your Appointment Booking?
          </h2>
          <p
            style={{
              fontSize: 'var(--font-size-lg)',
              color: 'var(--color-text-secondary)',
              margin: '0 0 var(--spacing-2xl) 0',
            }}
          >
            Join thousands of businesses using AI to book more appointments 24/7.
          </p>
          <Link
            to="/register"
            className="btn btn--primary btn--lg"
            style={{
              animation: 'pulse 2s ease-in-out infinite',
            }}
          >
            Get Started
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* 12. FOOTER */}
      <footer
        style={{
          padding: 'var(--spacing-2xl)',
          borderTop: '2px solid #000',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))',
            gap: 'var(--spacing-xl)',
          }}
        >
          {/* Logo & Description */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
              <Logo size={40} variant="icon" />
              <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>setterapp.ai</span>
            </div>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
              AI appointment setter for Instagram. Automate your booking process 24/7.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h4 style={{ fontWeight: 700, marginBottom: 'var(--spacing-md)' }}>Product</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {['Features', 'Pricing', 'Integrations', 'API'].map((link) => (
                <li key={link} style={{ marginBottom: 'var(--spacing-sm)' }}>
                  <a
                    href="#"
                    style={{
                      color: 'var(--color-text-secondary)',
                      textDecoration: 'none',
                      fontSize: 'var(--font-size-sm)',
                      transition: 'color 0.2s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 style={{ fontWeight: 700, marginBottom: 'var(--spacing-md)' }}>Company</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {['About', 'Blog', 'Careers', 'Contact'].map((link) => (
                <li key={link} style={{ marginBottom: 'var(--spacing-sm)' }}>
                  <a
                    href="#"
                    style={{
                      color: 'var(--color-text-secondary)',
                      textDecoration: 'none',
                      fontSize: 'var(--font-size-sm)',
                      transition: 'color 0.2s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 style={{ fontWeight: 700, marginBottom: 'var(--spacing-md)' }}>Legal</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>
                <Link
                  to="/privacy"
                  style={{
                    color: 'var(--color-text-secondary)',
                    textDecoration: 'none',
                    fontSize: 'var(--font-size-sm)',
                    transition: 'color 0.2s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
                >
                  Privacy Policy
                </Link>
              </li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>
                <a
                  href="#"
                  style={{
                    color: 'var(--color-text-secondary)',
                    textDecoration: 'none',
                    fontSize: 'var(--font-size-sm)',
                    transition: 'color 0.2s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
                >
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div
          style={{
            maxWidth: '1200px',
            margin: 'var(--spacing-xl) auto 0',
            paddingTop: 'var(--spacing-lg)',
            borderTop: '1px solid #e0e0e0',
            textAlign: 'center',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          © 2025 setterapp.ai. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

export default Landing
