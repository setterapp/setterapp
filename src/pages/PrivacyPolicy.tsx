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
            ← Volver al inicio
          </Link>
          <h1 style={{ margin: 0, marginBottom: 'var(--spacing-md)', color: 'var(--color-text)' }}>
            Política de Privacidad
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            Última actualización: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div style={{ lineHeight: 1.8, color: 'var(--color-text)' }}>
          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>1. Información que Recopilamos</h2>
            <p>
              En AppSetter, recopilamos y procesamos la siguiente información para brindar nuestros servicios:
            </p>
            <ul style={{ paddingLeft: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>
                <strong>Información de cuenta:</strong> Email, nombre de usuario y datos de autenticación cuando te registras.
              </li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>
                <strong>Datos de integraciones:</strong> Información de tus cuentas conectadas (WhatsApp Business, Instagram, Google Calendar) necesaria para proporcionar nuestros servicios.
              </li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>
                <strong>Conversaciones y mensajes:</strong> Mensajes y conversaciones gestionadas a través de nuestros agentes de IA para permitir la automatización y respuesta automática.
              </li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>
                <strong>Configuración de agentes:</strong> Configuraciones y preferencias de tus agentes de IA personalizados.
              </li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>
                <strong>Datos de uso:</strong> Información sobre cómo usas nuestra plataforma, incluyendo métricas y estadísticas.
              </li>
            </ul>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>2. Cómo Usamos tu Información</h2>
            <p>Utilizamos la información recopilada para:</p>
            <ul style={{ paddingLeft: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Proporcionar, mantener y mejorar nuestros servicios</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Gestionar y responder mensajes automáticamente a través de agentes de IA</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Personalizar la experiencia del usuario</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Enviar notificaciones y actualizaciones sobre nuestros servicios</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Analizar el uso de la plataforma para mejorar nuestros servicios</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Cumplir con obligaciones legales y proteger nuestros derechos</li>
            </ul>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>3. Servicios de Terceros</h2>
            <p>
              Utilizamos los siguientes servicios de terceros que pueden recopilar información:
            </p>
            <ul style={{ paddingLeft: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>
                <strong>Supabase:</strong> Para autenticación, base de datos y almacenamiento. Consulta su política de privacidad en{' '}
                <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>
                  https://supabase.com/privacy
                </a>
              </li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>
                <strong>Meta/Facebook:</strong> Para integración con WhatsApp Business e Instagram. Consulta su política de privacidad en{' '}
                <a href="https://www.facebook.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>
                  https://www.facebook.com/privacy
                </a>
              </li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>
                <strong>Google:</strong> Para integración con Google Calendar. Consulta su política de privacidad en{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>
                  https://policies.google.com/privacy
                </a>
              </li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>
                <strong>OpenAI:</strong> Para servicios de IA y procesamiento de lenguaje natural. Consulta su política de privacidad en{' '}
                <a href="https://openai.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>
                  https://openai.com/privacy
                </a>
              </li>
            </ul>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>4. Seguridad de los Datos</h2>
            <p>
              Implementamos medidas de seguridad técnicas y organizativas para proteger tu información personal contra acceso no autorizado, alteración, divulgación o destrucción. Esto incluye:
            </p>
            <ul style={{ paddingLeft: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Encriptación de datos en tránsito y en reposo</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Autenticación segura y control de acceso</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Monitoreo regular de seguridad</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Almacenamiento seguro en infraestructura de terceros confiables</li>
            </ul>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>5. Tus Derechos</h2>
            <p>Tienes derecho a:</p>
            <ul style={{ paddingLeft: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Acceder a tu información personal</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Corregir información inexacta</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Solicitar la eliminación de tus datos</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Exportar tus datos</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Retirar tu consentimiento en cualquier momento</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Desconectar integraciones en cualquier momento desde la configuración</li>
            </ul>
            <p style={{ marginTop: 'var(--spacing-md)' }}>
              Para ejercer estos derechos, puedes contactarnos a través de la configuración de tu cuenta o eliminando tu cuenta directamente.
            </p>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>6. Retención de Datos</h2>
            <p>
              Conservamos tu información personal mientras tu cuenta esté activa o según sea necesario para brindar nuestros servicios. Cuando eliminas tu cuenta, eliminamos o anonimizamos tu información personal, excepto cuando la ley nos obligue a conservarla.
            </p>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>7. Cambios a esta Política</h2>
            <p>
              Podemos actualizar esta Política de Privacidad ocasionalmente. Te notificaremos sobre cambios importantes publicando la nueva política en esta página y actualizando la fecha de "Última actualización". Te recomendamos revisar esta política periódicamente.
            </p>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>8. Contacto</h2>
            <p>
              Si tienes preguntas sobre esta Política de Privacidad o sobre cómo manejamos tus datos, puedes contactarnos a través de tu cuenta en la plataforma o visitando{' '}
              <a href="https://setterapp.ai" style={{ color: 'var(--color-primary)' }}>setterapp.ai</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicy



