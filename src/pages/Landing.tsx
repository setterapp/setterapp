import { Link } from 'react-router-dom'
import { Brain, ArrowRight, Check } from 'lucide-react'
import WhatsAppIcon from '../components/icons/WhatsAppIcon'
import InstagramIcon from '../components/icons/InstagramIcon'

function Landing() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Header */}
      <header
        style={{
          padding: 'var(--spacing-xl) var(--spacing-xl)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <Brain size={32} color="var(--color-primary)" />
          <h1 style={{ margin: 0, fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text)' }}>
            AppSetter
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
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
        style={{
          padding: '80px var(--spacing-xl)',
          textAlign: 'center',
          maxWidth: '900px',
          margin: '0 auto',
        }}
      >
        <h2
          style={{
            fontSize: '3.5rem',
            fontWeight: 700,
            margin: '0 0 var(--spacing-xl) 0',
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
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'center' }}>
          <Link to="/register" className="btn btn--primary btn--lg">
            Comenzar gratis
            <ArrowRight size={20} />
          </Link>
          <Link to="/login" className="btn btn--secondary btn--lg">
            Iniciar sesión
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section
        style={{
          padding: '80px var(--spacing-xl)',
          background: 'var(--color-bg-secondary)',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h3
            style={{
              fontSize: '2.5rem',
              fontWeight: 700,
              textAlign: 'center',
              margin: '0 0 var(--spacing-2xl) 0',
              color: 'var(--color-text)',
            }}
          >
            Todo lo que necesitas en un solo lugar
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 'var(--spacing-xl)',
            }}
          >
            {/* Feature 1 */}
            <div
              className="card"
              style={{
                padding: 'var(--spacing-2xl)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: 'var(--border-radius-lg)',
                  background: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto var(--spacing-md)',
                }}
              >
                <Brain size={32} color="white" />
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
              className="card"
              style={{
                padding: 'var(--spacing-2xl)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: 'var(--border-radius-lg)',
                  background: '#25D366',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto var(--spacing-md)',
                }}
              >
                <WhatsAppIcon size={32} color="white" />
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
              className="card"
              style={{
                padding: 'var(--spacing-2xl)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: 'var(--border-radius-lg)',
                  background: '#E4405F',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto var(--spacing-md)',
                }}
              >
                <InstagramIcon size={32} color="white" />
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
      <section style={{ padding: '80px var(--spacing-xl)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h3
            style={{
              fontSize: '2.5rem',
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
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'var(--color-success)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Check size={20} color="white" />
                </div>
                <p style={{ fontSize: 'var(--font-size-lg)', margin: 0, color: 'var(--color-text)' }}>
                  {benefit}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        style={{
          padding: '80px var(--spacing-xl)',
          background: 'var(--color-bg-secondary)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h3
            style={{
              fontSize: '2.5rem',
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
          borderTop: '1px solid var(--color-border)',
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
        }}
      >
        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>
          © 2024 AppSetter. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  )
}

export default Landing
