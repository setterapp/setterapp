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
  TrendingUp,
  Zap,
  GraduationCap,
  Percent,
  UserX
} from 'lucide-react'
import { motion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import InstagramIcon from '../components/icons/InstagramIcon'
import Logo from '../components/Logo'

// Animation variants for scroll animations
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6 }
  }
}

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5 }
  }
}

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
}

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 }
  }
}

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
          padding: 'clamp(var(--spacing-md), 3vw, var(--spacing-lg))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: isOpen ? 'var(--color-bg-secondary)' : 'var(--color-bg)',
          transition: 'background 0.2s ease',
        }}
      >
        <h4 style={{ margin: 0, fontSize: 'clamp(14px, 3.5vw, var(--font-size-lg))', fontWeight: 600 }}>
          {question}
        </h4>
        <ChevronDown
          size={22}
          style={{
            transition: 'transform 0.3s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
            marginLeft: 'var(--spacing-sm)'
          }}
        />
      </div>
      <div
        style={{
          maxHeight: isOpen ? '500px' : '0',
          overflow: 'hidden',
          transition: 'max-height 0.3s ease, padding 0.3s ease',
          padding: isOpen ? 'clamp(var(--spacing-md), 3vw, var(--spacing-lg))' : '0 clamp(var(--spacing-md), 3vw, var(--spacing-lg))',
          borderTop: isOpen ? '2px solid #000' : 'none',
        }}
      >
        <p style={{ margin: 0, color: 'var(--color-text-secondary)', lineHeight: 1.6, fontSize: 'clamp(13px, 3vw, 15px)' }}>
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
      question: "How long does setup take?",
      answer: "Setup takes about 5-10 minutes. Connect your Instagram account, link your Google Calendar, add your business information and FAQs, and you're ready to go. No technical knowledge required."
    },
    {
      question: "How does the AI setter integrate with my calendar?",
      answer: "Our AI appointment setter integrates directly with Google Calendar. The AI can check your availability in real-time and book appointments automatically, sending calendar invites with video call links. This automated scheduling works 24/7."
    },
    {
      question: "Can I review messages before the AI sends them?",
      answer: "Yes! You can enable 'hold for review' mode where the AI drafts responses but waits for your approval before sending. You can also set it to auto-respond and only escalate when it's unsure."
    },
    {
      question: "What happens if the AI doesn't know how to respond?",
      answer: "Our AI appointment setter is smart enough to recognize when it needs human help. It can escalate conversations to you, hold messages for review, or provide a polite response asking the customer to wait for a human response."
    },
    {
      question: "Does it work in Spanish or other languages?",
      answer: "Yes! The AI can understand and respond in multiple languages including Spanish, Portuguese, and English. It automatically detects the language your leads are using and responds accordingly."
    },
    {
      question: "How much does an AI appointment setter cost vs a human setter?",
      answer: "Human setters typically cost $500-2000+ monthly plus 10-30% commissions. Our AI appointment setter starts at just $49/month (Starter plan) with zero commissions, saving you up to 80% while providing 24/7 automated appointment booking. We also offer Growth ($99/mo) and Premium ($347/mo) plans for larger teams."
    }
  ]

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#fff',
        backgroundImage: `
          linear-gradient(rgba(0, 0, 0, 0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 0, 0, 0.06) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: '#fff',
          borderBottom: '2px solid #000',
        }}
      >
        <style>
          {`
            .landing-header {
              padding: 12px 16px;
              display: flex !important;
              flex-direction: row !important;
              justify-content: space-between;
              align-items: center;
              flex-wrap: nowrap !important;
              gap: 8px;
              max-width: 1400px;
              margin: 0 auto;
            }
            .landing-header .logo-link {
              text-decoration: none;
              color: inherit;
              display: flex;
              align-items: center;
              gap: 6px;
              min-width: 0;
              margin-right: auto;
            }
            .landing-header .logo-icon {
              flex-shrink: 0;
              width: 28px;
              height: 28px;
            }
            .landing-header .logo-text {
              font-size: 16px;
              font-weight: 700;
              color: #000;
              white-space: nowrap;
            }
            .landing-header .header-buttons {
              display: flex;
              gap: 8px;
              align-items: center;
              flex-shrink: 0;
            }
            .landing-header .header-btn {
              padding: 8px 16px;
              font-size: 14px;
              white-space: nowrap;
            }
            @media (max-width: 600px) {
              .landing-header {
                padding: 8px 10px;
                gap: 6px;
              }
              .landing-header .logo-icon {
                width: 24px;
                height: 24px;
              }
              .landing-header .logo-text {
                font-size: 13px;
              }
              .landing-header .header-buttons {
                gap: 4px;
              }
              .landing-header .header-btn {
                padding: 6px 10px;
                font-size: 12px;
              }
            }
            @media (max-width: 420px) {
              .landing-header {
                padding: 6px 8px;
              }
              .landing-header .logo-icon {
                width: 22px;
                height: 22px;
              }
              .landing-header .logo-text {
                display: none;
              }
              .landing-header .header-btn {
                padding: 5px 8px;
                font-size: 11px;
              }
            }
          `}
        </style>
        <header className="landing-header">
          <Link to="/" className="logo-link">
            <div className="logo-icon">
              <Logo size={28} variant="icon" />
            </div>
            <span className="logo-text">setterapp.ai</span>
          </Link>
          <div className="header-buttons">
            <Link to="/login" className="btn header-btn" style={{ background: '#fff', color: '#000', border: '2px solid #000' }}>
              Log In
            </Link>
            <Link to="/register" className="btn header-btn" style={{ background: '#000', color: '#fff', border: '2px solid #000' }}>
              Get Started
            </Link>
          </div>
        </header>
      </div>

      {/* 1. HERO SECTION */}
      <section
        className="landing-hero"
        style={{
          padding: 'clamp(40px, 10vw, 120px) clamp(16px, 4vw, var(--spacing-xl))',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          {/* Connected Logos */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'clamp(12px, 4vw, 24px)',
              margin: '0 auto clamp(var(--spacing-lg), 5vw, var(--spacing-xl))',
            }}
          >
            {/* Robot Logo */}
            <div
              style={{
                width: 'clamp(50px, 15vw, 80px)',
                height: 'clamp(50px, 15vw, 80px)',
                background: 'var(--color-primary)',
                border: '2px solid #000',
                borderRadius: 'clamp(8px, 2vw, 12px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '3px 3px 0px 0px #000',
                animation: 'float 3s ease-in-out infinite',
              }}
            >
              <Logo size={32} variant="icon" />
            </div>

            {/* Animated Connection Line */}
            <div
              style={{
                position: 'relative',
                width: 'clamp(30px, 10vw, 60px)',
                height: '4px',
                background: 'linear-gradient(90deg, var(--color-primary) 0%, #f38ba8 100%)',
                borderRadius: '2px',
              }}
            >
              {/* Animated dots */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '0',
                  width: '8px',
                  height: '8px',
                  background: '#fff',
                  borderRadius: '50%',
                  transform: 'translateY(-50%)',
                  animation: 'slideData 2s ease-in-out infinite',
                  boxShadow: '0 0 8px rgba(255,255,255,0.8)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: '0',
                  width: '8px',
                  height: '8px',
                  background: '#fff',
                  borderRadius: '50%',
                  transform: 'translateY(-50%)',
                  animation: 'slideDataReverse 2s ease-in-out infinite',
                  boxShadow: '0 0 8px rgba(255,255,255,0.8)',
                }}
              />
            </div>

            {/* Instagram Logo */}
            <div
              style={{
                width: 'clamp(50px, 15vw, 80px)',
                height: 'clamp(50px, 15vw, 80px)',
                background: '#f38ba8',
                border: '2px solid #000',
                borderRadius: 'clamp(8px, 2vw, 12px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '3px 3px 0px 0px #000',
                animation: 'float 3s ease-in-out infinite 0.5s',
              }}
            >
              <InstagramIcon size={32} color="#000" />
            </div>
          </div>

          <style>
            {`
              @keyframes slideData {
                0%, 100% { left: 0; opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { left: calc(100% - 8px); opacity: 0; }
              }
              @keyframes slideDataReverse {
                0%, 100% { right: 0; opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { right: calc(100% - 8px); opacity: 0; }
              }
            `}
          </style>

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
            Turn Instagram DMs Into
            <br />
            <span
              style={{
                background: 'linear-gradient(45deg, #3b82f6, #a855f7, #f38ba8, #3b82f6)',
                backgroundSize: '300% 300%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                animation: 'gradientShift 4s ease infinite',
              }}
            >
              Booked Calls
            </span>
          </h1>

          <h2
            style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 500,
              color: 'var(--color-text-secondary)',
              margin: '0 0 var(--spacing-lg) 0',
              lineHeight: 1.6,
              maxWidth: '700px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            AI appointment setter that responds instantly, qualifies leads, and books meetings 24/7. Zero commissions, zero training, zero headaches.
          </h2>

          {/* Meta Tech Provider Badge - PROMINENT */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'clamp(4px, 1.5vw, 10px)',
              background: 'linear-gradient(135deg, #0081FB 0%, #00a3ff 100%)',
              border: '2px solid #000',
              borderRadius: 'clamp(6px, 1.5vw, 12px)',
              padding: 'clamp(4px, 1vw, 12px) clamp(8px, 2vw, 20px)',
              margin: '0 0 clamp(var(--spacing-lg), 5vw, var(--spacing-xl)) 0',
              boxShadow: '3px 3px 0px 0px #000',
            }}
          >
            {/* Infinity Symbol */}
            <svg width={18} height={18} viewBox="0 0 16 16" fill="#fff" xmlns="http://www.w3.org/2000/svg">
              <path d="M5.68 5.792 7.345 7.75 5.681 9.708a2.75 2.75 0 1 1 0-3.916ZM8 6.978 6.416 5.113l-.014-.015a3.75 3.75 0 1 0 0 5.304l.014-.015L8 8.522l1.584 1.865.014.015a3.75 3.75 0 1 0 0-5.304l-.014.015zm.656.772 1.663-1.958a2.75 2.75 0 1 1 0 3.916z"/>
            </svg>
            <span style={{ fontSize: 'clamp(10px, 2.5vw, 15px)', fontWeight: 700, color: '#fff', letterSpacing: '0.2px' }}>
              Official Meta Tech Provider
            </span>
          </div>

          <div className="landing-hero-buttons" style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/register"
              className="btn btn--lg"
              style={{
                animation: 'slideInUp 0.8s ease-out',
                background: '#000',
                color: '#fff',
                border: '2px solid #000',
                fontWeight: 600,
                padding: 'clamp(10px, 2.5vw, 16px) clamp(20px, 5vw, 32px)',
                fontSize: 'clamp(14px, 3.5vw, 18px)',
              }}
            >
              Get Started
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* 2. PAIN POINTS SECTION */}
      <section
        className="landing-section"
        style={{
          padding: 'clamp(40px, 8vw, 60px) clamp(16px, 4vw, var(--spacing-xl))',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              textAlign: 'center',
              margin: '0 0 clamp(var(--spacing-xl), 6vw, var(--spacing-2xl)) 0',
              color: '#000',
            }}
          >
            Tired of This?
          </motion.h2>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="landing-pain-points-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
              gap: 'clamp(var(--spacing-md), 4vw, var(--spacing-lg))',
            }}
          >
            {[
              { text: "Paying 10-30% commission per booking", icon: DollarSign },
              { text: "Training setters who leave in 3 months", icon: Users },
              { text: "Losing leads at 3am because no one answers", icon: Clock },
              { text: "Slow responses that cool down hot leads", icon: TrendingUp },
            ].map((pain, index) => (
              <motion.div
                key={index}
                variants={staggerItem}
                whileHover={{ scale: 1.02, rotate: [-1, 1, -1, 0] }}
                transition={{ duration: 0.3 }}
                style={{
                  background: '#fff5f5',
                  border: '2px solid #000',
                  borderRadius: 'clamp(8px, 2vw, 12px)',
                  padding: 'clamp(var(--spacing-md), 3vw, var(--spacing-lg))',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'clamp(var(--spacing-sm), 3vw, var(--spacing-md))',
                  boxShadow: '3px 3px 0px 0px #000',
                  cursor: 'default',
                }}
              >
                <div
                  style={{
                    width: 'clamp(36px, 10vw, 48px)',
                    height: 'clamp(36px, 10vw, 48px)',
                    background: 'var(--color-danger)',
                    border: '2px solid #000',
                    borderRadius: 'clamp(6px, 2vw, 8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <X size={22} color="#000" strokeWidth={3} />
                </div>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 'clamp(13px, 3.5vw, 16px)' }}>
                  {pain.text}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 4. COMPARISON TABLE */}
      <section
        className="landing-section"
        style={{
          padding: 'clamp(40px, 8vw, 60px) clamp(16px, 4vw, var(--spacing-xl))',
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              textAlign: 'center',
              margin: '0 0 var(--spacing-2xl) 0',
              color: '#000',
            }}
          >
            AI vs Human Setter
          </motion.h2>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={scaleIn}
            className="card"
            style={{
              overflow: 'auto',
              padding: 0,
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '280px' }}>
              <thead>
                <tr style={{ background: '#89CFF0' }}>
                  <th style={{ padding: 'clamp(8px, 2vw, var(--spacing-md))', textAlign: 'left', borderBottom: '2px solid #000', fontWeight: 700, fontSize: 'clamp(12px, 3vw, 15px)' }}>
                    Aspect
                  </th>
                  <th style={{ padding: 'clamp(8px, 2vw, var(--spacing-md))', textAlign: 'center', borderBottom: '2px solid #000', fontWeight: 700, fontSize: 'clamp(12px, 3vw, 15px)' }}>
                    Human
                  </th>
                  <th style={{ padding: 'clamp(8px, 2vw, var(--spacing-md))', textAlign: 'center', borderBottom: '2px solid #000', fontWeight: 700, fontSize: 'clamp(12px, 3vw, 15px)' }}>
                    AI Setter
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { aspect: "Availability", icon: Clock, human: "8-10 hours", ai: "24/7" },
                  { aspect: "Monthly Cost", icon: DollarSign, human: "$500-2000+", ai: "From $49" },
                  { aspect: "Commissions", icon: Percent, human: "10-30%", ai: "0%" },
                  { aspect: "Response Time", icon: Zap, human: "5-30 min", ai: "Instant" },
                  { aspect: "Training Time", icon: GraduationCap, human: "Weeks", ai: "Minutes" },
                  { aspect: "Turnover", icon: UserX, human: "High", ai: "None" },
                ].map((row, index) => (
                  <tr key={index} style={{ borderBottom: index < 5 ? '1px solid #e0e0e0' : 'none' }}>
                    <td style={{ padding: 'clamp(8px, 2vw, var(--spacing-md))', fontWeight: 600, fontSize: 'clamp(12px, 3vw, 15px)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 1vw, var(--spacing-sm))' }}>
                        <row.icon size={16} strokeWidth={2.5} />
                        {row.aspect}
                      </div>
                    </td>
                    <td style={{ padding: 'clamp(8px, 2vw, var(--spacing-md))', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'clamp(11px, 2.5vw, 14px)' }}>
                      {row.human}
                    </td>
                    <td style={{
                      padding: 'clamp(8px, 2vw, var(--spacing-md))',
                      textAlign: 'center',
                      background: '#e8f5e9',
                      fontWeight: 600,
                      color: 'var(--color-success)',
                      fontSize: 'clamp(11px, 2.5vw, 14px)'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <Check size={14} strokeWidth={3} />
                        {row.ai}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* 5. FEATURES SECTION */}
      <section
        className="landing-features"
        style={{
          padding: 'clamp(40px, 8vw, 60px) clamp(16px, 4vw, var(--spacing-xl))',
        }}
      >
        <style>
          {`
            .features-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 24px;
            }
            @media (max-width: 700px) {
              .features-grid {
                grid-template-columns: 1fr;
                gap: 16px;
              }
            }
          `}
        </style>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            className="landing-section-title"
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              textAlign: 'center',
              margin: '0 0 48px 0',
              color: '#000',
            }}
          >
            AI Appointment Setter Features
          </motion.h2>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="features-grid"
          >
            {[
              { icon: InstagramIcon, title: "Instagram DM Automation", desc: "Handle DMs and schedule meetings automatically 24/7", color: "#f38ba8", isComponent: true },
              { icon: Calendar, title: "Automated Booking", desc: "Integrates with Google Calendar to book appointments in real-time", color: "#89b4fa" },
              { icon: Users, title: "AI Lead Qualification", desc: "Automatically qualify leads and track contacts with built-in CRM", color: "#cba6f7" },
              { icon: BarChart3, title: "Conversion Analytics", desc: "Monitor performance, response times, and booking rates", color: "#f9e2af" },
            ].map((feature, index) => (
              <motion.div
                key={index}
                variants={staggerItem}
                whileHover={{
                  scale: 1.02,
                  boxShadow: '6px 6px 0px 0px #000',
                  transition: { duration: 0.2 }
                }}
                style={{
                  background: '#fff',
                  border: '3px solid #000',
                  borderRadius: '16px',
                  padding: '24px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  boxShadow: '4px 4px 0px 0px #000',
                  cursor: 'default',
                }}
              >
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '12px',
                    background: feature.color,
                    border: '2px solid #000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {feature.isComponent ? (
                    <feature.icon size={26} color="#000" />
                  ) : (
                    <feature.icon size={26} color="#000" strokeWidth={2} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#000' }}>
                    {feature.title}
                  </h4>
                  <p style={{ color: '#555', margin: 0, lineHeight: 1.5, fontSize: '14px' }}>
                    {feature.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* SEE IT IN ACTION - Product Demo */}
      <section
        className="landing-section"
        style={{
          padding: 'clamp(40px, 8vw, 60px) clamp(16px, 4vw, var(--spacing-xl))',
        }}
      >
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              textAlign: 'center',
              margin: '0 0 var(--spacing-md) 0',
              color: '#000',
            }}
          >
            See It In Action
          </motion.h2>

          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            style={{
              textAlign: 'center',
              color: '#333',
              margin: '0 0 var(--spacing-2xl) 0',
              fontSize: 'var(--font-size-lg)',
            }}
          >
            Watch how our AI handles real Instagram conversations
          </motion.p>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={scaleIn}
            style={{
              background: '#fff',
              border: '3px solid #000',
              borderRadius: '20px',
              padding: 'var(--spacing-2xl)',
              boxShadow: '6px 6px 0px 0px #000',
              minHeight: '400px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--spacing-lg)',
            }}
          >
            {/* Placeholder for screenshot */}
            <div
              style={{
                width: '100%',
                maxWidth: '600px',
                aspectRatio: '16/10',
                background: 'linear-gradient(135deg, #f38ba8 0%, #cba6f7 100%)',
                border: '2px solid #000',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                <div
                  style={{
                    fontSize: '48px',
                    marginBottom: 'var(--spacing-md)',
                  }}
                >
                  💬
                </div>
                <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: '#000', margin: 0 }}>
                  Product Screenshot Coming Soon
                </p>
                <p style={{ fontSize: 'var(--font-size-sm)', color: '#333', marginTop: 'var(--spacing-sm)' }}>
                  AI conversation demo with real Instagram DMs
                </p>
              </div>
            </div>

            <p style={{ textAlign: 'center', color: '#666', fontSize: 'var(--font-size-sm)', maxWidth: '600px' }}>
              Our AI responds in seconds, understands context, and books appointments automatically—just like a top-tier human setter.
            </p>
          </motion.div>
        </div>
      </section>

      {/* STATS SECTION - Social Proof */}
      <section
        className="landing-section"
        style={{
          padding: 'clamp(40px, 8vw, 60px) clamp(16px, 4vw, var(--spacing-xl))',
        }}
      >
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={scaleIn}
            className="stats-bar"
            style={{
              background: '#fff',
              border: 'clamp(2px, 0.5vw, 3px) solid #000',
              borderRadius: 'clamp(12px, 3vw, 20px)',
              padding: 'clamp(var(--spacing-md), 4vw, var(--spacing-xl))',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(120px, 100%), 1fr))',
            }}
          >
            {[
              { number: '10,000+', label: 'Messages Sent' },
              { number: '10+', label: 'Happy Clients' },
              { number: '95%', label: 'Response Rate' },
              { number: '24/7', label: 'Always Available' },
            ].map((stat, index, arr) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                style={{
                  textAlign: 'center',
                  padding: 'clamp(var(--spacing-sm), 2vw, var(--spacing-md))',
                  borderRight: index < arr.length - 1 ? '2px solid #e0e0e0' : 'none',
                }}
              >
                <div
                  style={{
                    fontSize: 'clamp(1.25rem, 5vw, 2rem)',
                    fontWeight: 800,
                    color: '#000',
                    marginBottom: 'clamp(4px, 1vw, 8px)',
                    lineHeight: 1,
                  }}
                >
                  {stat.number}
                </div>
                <div
                  style={{
                    fontSize: 'clamp(11px, 2.5vw, var(--font-size-sm))',
                    fontWeight: 600,
                    color: '#666',
                  }}
                >
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 9. PRICING */}
      <section
        className="landing-section"
        style={{
          padding: 'clamp(50px, 10vw, 80px) clamp(16px, 4vw, var(--spacing-xl))',
        }}
      >
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              textAlign: 'center',
              margin: '0 0 var(--spacing-sm) 0',
              color: '#000',
            }}
          >
            Simple, Transparent Pricing
          </motion.h2>
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            style={{
              textAlign: 'center',
              color: '#333',
              margin: '0 0 var(--spacing-2xl) 0',
              fontSize: 'var(--font-size-lg)',
            }}
          >
            Choose the plan that fits your business
          </motion.p>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="landing-pricing-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
              gap: 'clamp(var(--spacing-md), 4vw, var(--spacing-xl))',
              alignItems: 'stretch',
              padding: '0 clamp(8px, 2vw, 0px)',
            }}
          >
            {/* Starter Plan */}
            <motion.div
              variants={staggerItem}
              whileHover={{ scale: 1.02, y: -5 }}
              style={{
                position: 'relative',
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
                padding: 'var(--spacing-lg)',
                borderRadius: '16px',
                border: '3px solid #000',
                boxShadow: '6px 6px 0px 0px #000',
              }}
            >
              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: '0 0 6px 0', color: '#000' }}>
                  Starter
                </h3>
                <p style={{ margin: '0', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1, color: '#000' }}>$49</span>
                  <span style={{ color: '#666', fontSize: 'var(--font-size-sm)' }}>/month</span>
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>
                  Perfect for getting started
                </p>
              </div>

              {/* Features */}
              <div style={{ flex: 1, marginBottom: 'var(--spacing-md)' }}>
                {[
                  "1 AI Agent",
                  "2,000 messages/month",
                  "1 Knowledge Base",
                  "Instagram DM automation",
                  "Unlimited Comment-to-DM automations",
                  "Google Calendar sync",
                  "Automatic appointment booking",
                  "Built-in CRM",
                  "Lead tracking & status",
                  "Email support",
                ].map((feature, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px',
                      fontSize: '13px',
                      color: '#000',
                    }}
                  >
                    <Check size={14} color="#10b981" strokeWidth={3} style={{ flexShrink: 0 }} />
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
                  background: '#000',
                  color: '#fff',
                  border: '2px solid #000',
                  fontWeight: 700,
                  padding: '12px 20px',
                  fontSize: '14px',
                }}
              >
                Get Started
              </Link>
            </motion.div>

            {/* Growth Plan - HIGHLIGHTED */}
            <motion.div
              variants={staggerItem}
              whileHover={{ scale: 1.05, y: -5 }}
              style={{
                position: 'relative',
                background: 'linear-gradient(45deg, #a5d8ff, #c4b5fd, #fcc2d7, #a5d8ff)',
                backgroundSize: '300% 300%',
                animation: 'gradientShift 4s ease infinite',
                display: 'flex',
                flexDirection: 'column',
                padding: 'var(--spacing-lg)',
                borderRadius: '16px',
                border: '3px solid #000',
                boxShadow: '8px 8px 0px 0px #000',
                transform: 'scale(1.03)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-14px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#000',
                  color: '#fff',
                  padding: '6px 20px',
                  borderRadius: '30px',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap',
                }}
              >
                MOST POPULAR
              </div>

              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: '0 0 6px 0', color: '#000' }}>
                  Growth
                </h3>
                <p style={{ margin: '0', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1, color: '#000' }}>$99</span>
                  <span style={{ color: '#333', fontSize: 'var(--font-size-sm)' }}>/month</span>
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#333' }}>
                  Best for growing businesses
                </p>
              </div>

              {/* Features */}
              <div style={{ flex: 1, marginBottom: 'var(--spacing-md)' }}>
                {[
                  "Everything in Starter +",
                  "3 AI Agents",
                  "10,000 messages/month",
                  "3 Knowledge Bases",
                  "Priority support",
                  "WhatsApp integration (coming soon)",
                ].map((feature, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px',
                      fontSize: '13px',
                      color: '#000',
                      fontWeight: 500,
                    }}
                  >
                    <Check size={14} color="#000" strokeWidth={3} style={{ flexShrink: 0 }} />
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
                  background: '#000',
                  color: '#fff',
                  border: '2px solid #000',
                  fontWeight: 700,
                  padding: '12px 20px',
                  fontSize: '14px',
                }}
              >
                Get Started
              </Link>
            </motion.div>

            {/* Premium Plan */}
            <motion.div
              variants={staggerItem}
              whileHover={{ scale: 1.02, y: -5 }}
              style={{
                position: 'relative',
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
                padding: 'var(--spacing-lg)',
                borderRadius: '16px',
                border: '3px solid #000',
                boxShadow: '6px 6px 0px 0px #000',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-14px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#a6e3a1',
                  color: '#000',
                  padding: '6px 20px',
                  borderRadius: '30px',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: '2px solid #000',
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap',
                }}
              >
                BEST VALUE
              </div>

              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: '0 0 6px 0', color: '#000' }}>
                  Premium
                </h3>
                <p style={{ margin: '0', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1, color: '#000' }}>$347</span>
                  <span style={{ color: '#666', fontSize: 'var(--font-size-sm)' }}>/month</span>
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>
                  For high-volume teams
                </p>
              </div>

              {/* Features */}
              <div style={{ flex: 1, marginBottom: 'var(--spacing-md)' }}>
                {[
                  "Everything in Growth +",
                  "10 AI Agents",
                  "Unlimited messages",
                  "10 Knowledge Bases",
                  "VIP Priority support",
                  "Personalized onboarding call",
                  "Early access to new features",
                ].map((feature, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px',
                      fontSize: '13px',
                      color: '#000',
                    }}
                  >
                    <Check size={14} color="#10b981" strokeWidth={3} style={{ flexShrink: 0 }} />
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
                  background: '#000',
                  color: '#fff',
                  border: '2px solid #000',
                  fontWeight: 700,
                  padding: '12px 20px',
                  fontSize: '14px',
                }}
              >
                Get Started
              </Link>
            </motion.div>
          </motion.div>

        </div>
      </section>

      {/* 10. FAQ */}
      <section
        className="landing-section"
        style={{
          padding: 'clamp(40px, 8vw, 60px) clamp(16px, 4vw, var(--spacing-xl))',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              textAlign: 'center',
              margin: '0 0 var(--spacing-2xl) 0',
              color: '#000',
            }}
          >
            Frequently Asked Questions
          </motion.h2>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            {faqs.map((faq, index) => (
              <motion.div key={index} variants={staggerItem}>
                <FAQItem
                  question={faq.question}
                  answer={faq.answer}
                  isOpen={openFAQ === index}
                  onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 11. FINAL CTA */}
      <section
        className="landing-cta"
        style={{
          padding: 'clamp(50px, 10vw, 80px) clamp(16px, 4vw, var(--spacing-xl))',
          textAlign: 'center',
        }}
      >
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={scaleIn}
          style={{ maxWidth: '700px', margin: '0 auto' }}
        >
          <h2
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              margin: '0 0 var(--spacing-md) 0',
              color: '#000',
            }}
          >
            Ready to Automate Your Appointment Booking?
          </h2>
          <p
            style={{
              fontSize: 'var(--font-size-lg)',
              color: '#333',
              margin: '0 0 var(--spacing-2xl) 0',
            }}
          >
            Join thousands of businesses using AI to book more appointments 24/7.
          </p>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              to="/register"
              className="btn btn--lg"
              style={{
                animation: 'pulse 2s ease-in-out infinite',
                background: '#000',
                color: '#fff',
                border: '2px solid #000',
                fontWeight: 600
              }}
            >
              Get Started
              <ArrowRight size={20} />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* 12. FOOTER */}
      <footer
        className="landing-footer"
        style={{
          padding: 'clamp(var(--spacing-xl), 6vw, var(--spacing-2xl))',
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
