import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  X,
  MessageSquare,
  Calendar,
  Users,
  BarChart3,
  Settings,
  ChevronDown,
  Clock,
  DollarSign,
  TrendingUp
} from 'lucide-react'
import WhatsAppIcon from '../components/icons/WhatsAppIcon'
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
      answer: "Our AI appointment setter uses advanced language models to understand and respond to Instagram DMs and WhatsApp messages naturally. It learns from your business context and can handle appointment booking, answer questions, and qualify leads automatically 24/7."
    },
    {
      question: "What platforms does your AI setter support?",
      answer: "Our AI setter currently supports WhatsApp Business automation and Instagram DM automation. The AI appointment setter can handle conversations on both platforms simultaneously, booking appointments around the clock."
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
      answer: "Human setters typically cost $500-2000+ monthly plus 10-30% commissions. Our AI appointment setter starts at just $49/month with zero commissions, saving you up to 80% while providing 24/7 automated appointment booking on Instagram and WhatsApp."
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
            Start Free
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
            Save up to 80%
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
            <span style={{ color: 'var(--color-primary)' }}>Instagram & WhatsApp</span>
          </h1>

          <p
            style={{
              fontSize: 'var(--font-size-lg)',
              color: 'var(--color-text-secondary)',
              margin: '0 0 var(--spacing-2xl) 0',
              lineHeight: 1.6,
              maxWidth: '700px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            Automate your appointment booking 24/7 with our AI setter. Handle Instagram DMs
            and WhatsApp messages automatically, qualify leads, and book meetings while you sleep.
          </p>

          <div className="landing-hero-buttons" style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" className="btn btn--primary btn--lg" style={{ animation: 'slideInUp 0.8s ease-out' }}>
              Start Free
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

      {/* 3. SOLUTION SECTION */}
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
            AI Setter vs Human Setter
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
              gap: 'var(--spacing-xl)',
            }}
          >
            {/* Before Card */}
            <div
              className="card"
              style={{
                background: '#fff5f5',
                animation: 'slideInLeft 0.6s ease-out',
                animationFillMode: 'both',
              }}
            >
              <div
                style={{
                  background: 'var(--color-danger)',
                  color: '#000',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  display: 'inline-block',
                  fontWeight: 700,
                  marginBottom: 'var(--spacing-lg)',
                  border: '2px solid #000',
                }}
              >
                BEFORE
              </div>
              <h3 style={{ fontSize: 'var(--font-size-xl)', margin: '0 0 var(--spacing-md) 0' }}>
                Human Setters
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {[
                  "High monthly salaries + commissions",
                  "Only available 8-10 hours/day",
                  "Need constant training & supervision",
                  "High turnover, start over every few months",
                  "Slow response times = lost leads"
                ].map((item, i) => (
                  <li key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm)',
                    marginBottom: 'var(--spacing-sm)',
                    color: 'var(--color-text-secondary)'
                  }}>
                    <X size={18} color="var(--color-danger)" strokeWidth={3} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* After Card */}
            <div
              className="card"
              style={{
                background: '#f0fff4',
                animation: 'slideInRight 0.6s ease-out',
                animationDelay: '0.2s',
                animationFillMode: 'both',
              }}
            >
              <div
                style={{
                  background: 'var(--color-success)',
                  color: '#000',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  display: 'inline-block',
                  fontWeight: 700,
                  marginBottom: 'var(--spacing-lg)',
                  border: '2px solid #000',
                }}
              >
                NOW
              </div>
              <h3 style={{ fontSize: 'var(--font-size-xl)', margin: '0 0 var(--spacing-md) 0' }}>
                SetterApp.ai
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {[
                  "Fixed low monthly cost, no commissions",
                  "Available 24/7, never takes a break",
                  "Set it up once, works forever",
                  "No turnover, always improving",
                  "Instant responses = more conversions"
                ].map((item, i) => (
                  <li key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm)',
                    marginBottom: 'var(--spacing-sm)',
                    color: 'var(--color-text-secondary)'
                  }}>
                    <Check size={18} color="var(--color-success)" strokeWidth={3} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
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
                <tr style={{ background: 'var(--color-bg-secondary)' }}>
                  <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', borderBottom: '2px solid #000', fontWeight: 700 }}>
                    Aspect
                  </th>
                  <th style={{ padding: 'var(--spacing-md)', textAlign: 'center', borderBottom: '2px solid #000', fontWeight: 700 }}>
                    Human Setter
                  </th>
                  <th style={{ padding: 'var(--spacing-md)', textAlign: 'center', borderBottom: '2px solid #000', fontWeight: 700, background: '#e8f5e9' }}>
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
              { icon: WhatsAppIcon, title: "WhatsApp Automation", desc: "AI setter for WhatsApp Business - automate conversations and book appointments 24/7", color: "#a6e3a1", isComponent: true },
              { icon: InstagramIcon, title: "Instagram DM Automation", desc: "AI appointment setter for Instagram - handle DMs and schedule meetings automatically", color: "#f38ba8", isComponent: true },
              { icon: Calendar, title: "Automated Appointment Booking", desc: "Integrates with Google Calendar to book appointments automatically in real-time", color: "#89b4fa" },
              { icon: Users, title: "AI Lead Qualification", desc: "Automatically qualify leads and track contacts with built-in CRM", color: "#cba6f7" },
              { icon: BarChart3, title: "Conversion Analytics", desc: "Monitor AI setter performance, response times, and booking conversion rates", color: "#f9e2af" },
              { icon: Settings, title: "Customizable AI Agent", desc: "Customize your AI appointment setter's personality, responses, and business rules", color: "#94e2d5" },
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

      {/* 6. HOW IT WORKS */}
      <section
        style={{
          padding: '60px var(--spacing-xl)',
        }}
      >
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              textAlign: 'center',
              margin: '0 0 var(--spacing-2xl) 0',
              color: 'var(--color-text)',
            }}
          >
            Get Started in 3 Steps
          </h2>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 'var(--spacing-lg)',
              flexWrap: 'wrap',
              position: 'relative',
            }}
          >
            {/* Connecting Line (hidden on mobile) */}
            <div
              style={{
                position: 'absolute',
                top: '60px',
                left: '20%',
                right: '20%',
                height: '4px',
                background: '#000',
                display: 'none',
              }}
              className="steps-line"
            />

            {[
              { icon: MessageSquare, title: "Connect your channels", desc: "Link your Instagram and WhatsApp accounts in minutes" },
              { icon: Settings, title: "Configure your agent", desc: "Set up your AI with your business info and preferences" },
              { icon: Calendar, title: "Start booking", desc: "Watch as your AI handles conversations and books appointments" },
            ].map((step, index) => (
              <div
                key={index}
                style={{
                  flex: '1 1 min(250px, 100%)',
                  minWidth: 0,
                  textAlign: 'center',
                  animation: 'bounceIn 0.6s ease-out',
                  animationDelay: `${index * 0.2}s`,
                  animationFillMode: 'both',
                }}
              >
                <div
                  style={{
                    width: 'clamp(70px, 18vw, 100px)',
                    height: 'clamp(70px, 18vw, 100px)',
                    background: 'var(--color-primary)',
                    border: '2px solid #000',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto var(--spacing-md)',
                    boxShadow: '3px 3px 0px 0px #000',
                    position: 'relative',
                  }}
                >
                  <step.icon size={36} color="#000" strokeWidth={2} />
                  <div
                    style={{
                      position: 'absolute',
                      top: '-10px',
                      right: '-10px',
                      width: '36px',
                      height: '36px',
                      background: '#000',
                      color: '#fff',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 'var(--font-size-lg)',
                    }}
                  >
                    {index + 1}
                  </div>
                </div>
                <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, margin: '0 0 var(--spacing-sm) 0' }}>
                  {step.title}
                </h4>
                <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* 9. PRICING */}
      <section
        style={{
          padding: '60px var(--spacing-xl)',
        }}
      >
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              textAlign: 'center',
              margin: '0 0 var(--spacing-sm) 0',
              color: 'var(--color-text)',
            }}
          >
            Simple Pricing
          </h2>
          <p
            style={{
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              margin: '0 0 var(--spacing-2xl) 0',
              fontSize: 'var(--font-size-lg)',
            }}
          >
            No hidden fees. Cancel anytime.
          </p>

          <div
            className="card"
            style={{
              position: 'relative',
              background: 'var(--color-primary)',
              animation: 'fadeInScale 0.5s ease-out',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-12px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#000',
                color: '#fff',
                padding: '4px 16px',
                borderRadius: '20px',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
              }}
            >
              EARLY ACCESS
            </div>
            <p style={{ margin: '0 0 var(--spacing-md) 0' }}>
              <span style={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', fontWeight: 700 }}>$49</span>
              <span style={{ color: 'var(--color-text-secondary)' }}>/month</span>
            </p>
            <p style={{
              margin: '0 0 var(--spacing-lg) 0',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-sm)'
            }}>
              Lock in this price before we raise it
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--spacing-lg) 0', textAlign: 'left' }}>
              {[
                "Unlimited messages",
                "Instagram & WhatsApp",
                "Google Calendar integration",
                "AI lead qualification",
                "Built-in CRM",
                "24/7 automated responses",
                "Email support"
              ].map((feature, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm)',
                    marginBottom: 'var(--spacing-sm)',
                  }}
                >
                  <Check size={18} color="var(--color-success)" strokeWidth={3} />
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              to="/register"
              className="btn btn--secondary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Start 14-Day Free Trial
            </Link>
            <p style={{
              margin: 'var(--spacing-md) 0 0 0',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)'
            }}>
              No credit card required
            </p>
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
            14-day free trial
          </div>
          <h2
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              margin: '0 0 var(--spacing-md) 0',
              color: 'var(--color-text)',
            }}
          >
            Get Your AI Appointment Setter Today
          </h2>
          <p
            style={{
              fontSize: 'var(--font-size-lg)',
              color: 'var(--color-text-secondary)',
              margin: '0 0 var(--spacing-2xl) 0',
            }}
          >
            Stop losing leads. Start booking appointments 24/7 on Instagram & WhatsApp.
          </p>
          <Link
            to="/register"
            className="btn btn--primary btn--lg"
            style={{
              animation: 'pulse 2s ease-in-out infinite',
            }}
          >
            Start Free Trial
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
              AI appointment setter for Instagram and WhatsApp. Automate your booking process 24/7.
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
