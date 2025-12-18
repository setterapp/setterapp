import { Link } from 'react-router-dom'
import { ArrowRight, Check, Zap, MessageSquare } from 'lucide-react'
import WhatsAppIcon from '../components/icons/WhatsAppIcon'
import InstagramIcon from '../components/icons/InstagramIcon'

function Landing() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
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
          <div
            style={{
              width: '48px',
              height: '48px',
              background: 'var(--color-primary)',
              border: '4px solid #000',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '4px 4px 0px 0px #000',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          >
            <Zap size={24} color="#000" fill="#000" />
          </div>
          <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text)' }}>
            AppSetter
          </span>
        </Link>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/login" className="btn btn--ghost">
            Iniciar sesión
          </Link>
          <Link to="/register" className="btn btn--primary">
            Comenzar gratis
          </Link>
        </div>
      </header>

      {/* Hero Section */}
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
          }}
        >
          <div
            style={{
              width: '120px',
              height: '120px',
              background: 'var(--color-bg-secondary)',
              border: '4px solid #000',
              borderRadius: '12px',
              margin: '0 auto var(--spacing-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '4px 4px 0px 0px #000',
              animation: 'float 3s ease-in-out infinite',
            }}
          >
            <MessageSquare size={64} color="#000" strokeWidth={2.5} />
          </div>
          <h2
            className="landing-hero-title"
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              fontWeight: 700,
              margin: '0 0 var(--spacing-lg) 0',
              color: 'var(--color-text)',
              lineHeight: 1.2,
            }}
          >
            Automatiza tus conversaciones con{' '}
            <span style={{ color: 'var(--color-primary)' }}>Agentes de IA</span>
          </h2>
          <p
            style={{
              fontSize: 'var(--font-size-lg)',
              color: 'var(--color-text-secondary)',
              margin: '0 0 var(--spacing-2xl) 0',
              lineHeight: 1.6,
            }}
          >
            Conecta WhatsApp e Instagram. Crea agentes inteligentes que gestionen
            tus conversaciones automáticamente.
          </p>
          <div className="landing-hero-buttons" style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" className="btn btn--primary btn--lg" style={{ animation: 'slideInUp 0.8s ease-out' }}>
              Comenzar gratis
              <ArrowRight size={20} />
            </Link>
            <Link to="/login" className="btn btn--secondary btn--lg" style={{ animation: 'slideInUp 1s ease-out' }}>
              Iniciar sesión
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        className="landing-features"
        style={{
          padding: '60px var(--spacing-xl)',
          background: 'var(--color-bg-secondary)',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h3
            className="landing-section-title"
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              textAlign: 'center',
              margin: '0 0 var(--spacing-2xl) 0',
              color: 'var(--color-text)',
            }}
          >
            Todo lo que necesitas en un solo lugar
          </h3>
          <div
            className="landing-features-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 'var(--spacing-lg)',
            }}
          >
            {/* Feature 1 */}
            <div
              className="card card--hover"
              style={{
                padding: 'var(--spacing-2xl)',
                textAlign: 'center',
                animation: 'slideInUp 0.6s ease-out',
                animationDelay: '0.1s',
                animationFillMode: 'both',
              }}
            >
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '12px',
                  background: 'var(--color-primary)',
                  border: '4px solid #000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto var(--spacing-md)',
                  boxShadow: '4px 4px 0px 0px #000',
                }}
              >
                <Zap size={40} color="#000" fill="#000" />
              </div>
              <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, margin: '0 0 var(--spacing-sm) 0' }}>
                Agentes de IA
              </h4>
              <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
                Crea y personaliza agentes inteligentes que respondan automáticamente a tus clientes
              </p>
            </div>

            {/* Feature 2 */}
            <div
              className="card card--hover"
              style={{
                padding: 'var(--spacing-2xl)',
                textAlign: 'center',
                animation: 'slideInUp 0.6s ease-out',
                animationDelay: '0.2s',
                animationFillMode: 'both',
              }}
            >
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '12px',
                  background: '#a6e3a1',
                  border: '4px solid #000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto var(--spacing-md)',
                  boxShadow: '4px 4px 0px 0px #000',
                }}
              >
                <WhatsAppIcon size={40} color="#000" />
              </div>
              <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, margin: '0 0 var(--spacing-sm) 0' }}>
                WhatsApp Business
              </h4>
              <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
                Integra tu cuenta de WhatsApp Business para gestionar conversaciones automáticamente
              </p>
            </div>

            {/* Feature 3 */}
            <div
              className="card card--hover"
              style={{
                padding: 'var(--spacing-2xl)',
                textAlign: 'center',
                animation: 'slideInUp 0.6s ease-out',
                animationDelay: '0.3s',
                animationFillMode: 'both',
              }}
            >
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '12px',
                  background: '#f38ba8',
                  border: '4px solid #000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto var(--spacing-md)',
                  boxShadow: '4px 4px 0px 0px #000',
                }}
              >
                <InstagramIcon size={40} color="#000" />
              </div>
              <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, margin: '0 0 var(--spacing-sm) 0' }}>
                Instagram
              </h4>
              <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
                Integra tu cuenta de Instagram para gestionar mensajes directos automáticamente
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="landing-benefits" style={{ padding: '60px var(--spacing-xl)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h3
            className="landing-section-title"
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              textAlign: 'center',
              margin: '0 0 var(--spacing-2xl) 0',
              color: 'var(--color-text)',
            }}
          >
            ¿Por qué elegir AppSetter?
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
            {[
              'Respuestas automáticas 24/7',
              'Integración con múltiples plataformas',
              'Análisis y métricas en tiempo real',
              'Fácil de configurar y usar',
              'Escalable para cualquier negocio',
            ].map((benefit, index) => (
              <div
                key={index}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-md)',
                  padding: 'var(--spacing-lg)',
                  animation: `slideInLeft 0.5s ease-out`,
                  animationDelay: `${index * 0.1}s`,
                  animationFillMode: 'both',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: 'var(--color-success)',
                    border: '4px solid #000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '2px 2px 0px 0px #000',
                  }}
                >
                  <Check size={20} color="#000" strokeWidth={3} />
                </div>
                <p style={{ fontSize: 'var(--font-size-lg)', margin: 0, color: 'var(--color-text)', fontWeight: 500 }}>
                  {benefit}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        className="landing-cta"
        style={{
          padding: '60px var(--spacing-xl)',
          background: 'var(--color-bg-secondary)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h3
            className="landing-section-title"
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
              fontWeight: 700,
              margin: '0 0 var(--spacing-md) 0',
              color: 'var(--color-text)',
            }}
          >
            ¿Listo para comenzar?
          </h3>
          <p
            style={{
              fontSize: 'var(--font-size-lg)',
              color: 'var(--color-text-secondary)',
              margin: '0 0 var(--spacing-2xl) 0',
            }}
          >
            Únete a miles de empresas que ya están automatizando sus conversaciones
          </p>
          <Link to="/register" className="btn btn--primary btn--lg">
            Comenzar gratis
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: 'var(--spacing-2xl)',
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 'var(--spacing-md)',
          flexWrap: 'wrap',
          marginBottom: 'var(--spacing-md)'
        }}>
          <Link
            to="/privacy"
            style={{
              color: 'var(--color-text-secondary)',
              textDecoration: 'none',
              fontSize: 'var(--font-size-sm)',
              transition: 'var(--transition)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
          >
            Política de Privacidad
          </Link>
        </div>
        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>
          © 2024 AppSetter. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  )
}

export default Landing
