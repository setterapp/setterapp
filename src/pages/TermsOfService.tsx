import { Link } from 'react-router-dom'

function TermsOfService() {
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
            Términos de Servicio
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            Última actualización: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div style={{ lineHeight: 1.8, color: 'var(--color-text)' }}>
          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>1. Aceptación de los Términos</h2>
            <p>
              Al acceder y utilizar setterapp.ai ("el Servicio"), aceptas estar sujeto a estos Términos de Servicio. Si no estás de acuerdo con alguna parte de estos términos, no podrás acceder al Servicio.
            </p>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>2. Descripción del Servicio</h2>
            <p>
              setterapp.ai es una plataforma de CRM y mensajería multicanal que permite:
            </p>
            <ul style={{ paddingLeft: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Gestionar conversaciones de WhatsApp Business e Instagram en un solo lugar</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Configurar agentes de IA para respuestas automáticas</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Clasificar y gestionar leads</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Programar reuniones automáticamente con integración de Google Calendar</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Visualizar analíticas y métricas de rendimiento</li>
            </ul>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>3. Cuentas de Usuario</h2>
            <p>Para utilizar el Servicio, debes:</p>
            <ul style={{ paddingLeft: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Crear una cuenta proporcionando información precisa y completa</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Mantener la seguridad de tu cuenta y contraseña</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Notificarnos inmediatamente sobre cualquier uso no autorizado</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Ser responsable de todas las actividades que ocurran bajo tu cuenta</li>
            </ul>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>4. Uso Aceptable</h2>
            <p>Al utilizar el Servicio, aceptas NO:</p>
            <ul style={{ paddingLeft: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Enviar spam o mensajes no solicitados</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Violar las políticas de WhatsApp, Instagram, Facebook o Google</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Usar el servicio para actividades ilegales o fraudulentas</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Interferir con el funcionamiento del Servicio</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Intentar acceder a cuentas o datos de otros usuarios</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Usar el servicio de manera que pueda dañar, deshabilitar o sobrecargar nuestros servidores</li>
            </ul>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>5. Integraciones de Terceros</h2>
            <p>
              El Servicio se integra con plataformas de terceros incluyendo Meta (WhatsApp, Instagram, Facebook), Google y OpenAI. Al conectar estas integraciones:
            </p>
            <ul style={{ paddingLeft: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Autorizas a setterapp.ai a acceder a tus datos en esas plataformas</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Aceptas cumplir con los términos de servicio de cada plataforma</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Entiendes que la disponibilidad puede depender de esos servicios externos</li>
            </ul>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>6. Propiedad Intelectual</h2>
            <p>
              El Servicio y todo su contenido, características y funcionalidad son propiedad de setterapp.ai y están protegidos por leyes de propiedad intelectual. No puedes copiar, modificar, distribuir o crear obras derivadas sin nuestro consentimiento expreso.
            </p>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>7. Limitación de Responsabilidad</h2>
            <p>
              El Servicio se proporciona "tal cual" y "según disponibilidad". No garantizamos que el Servicio será ininterrumpido, seguro o libre de errores. En la máxima medida permitida por la ley, no seremos responsables por:
            </p>
            <ul style={{ paddingLeft: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Pérdida de datos o interrupción del negocio</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Daños indirectos, incidentales o consecuentes</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Problemas causados por integraciones de terceros</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Acciones de los agentes de IA que no cumplan tus expectativas</li>
            </ul>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>8. Terminación</h2>
            <p>
              Podemos suspender o terminar tu acceso al Servicio inmediatamente, sin previo aviso, si:
            </p>
            <ul style={{ paddingLeft: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Violas estos Términos de Servicio</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Violas las políticas de las plataformas integradas</li>
              <li style={{ marginBottom: 'var(--spacing-sm)' }}>Tu uso pone en riesgo la seguridad del Servicio</li>
            </ul>
            <p style={{ marginTop: 'var(--spacing-md)' }}>
              Puedes cancelar tu cuenta en cualquier momento desde la configuración de tu cuenta.
            </p>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>9. Cambios a los Términos</h2>
            <p>
              Nos reservamos el derecho de modificar estos términos en cualquier momento. Te notificaremos sobre cambios importantes. El uso continuado del Servicio después de los cambios constituye tu aceptación de los nuevos términos.
            </p>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>10. Ley Aplicable</h2>
            <p>
              Estos términos se regirán e interpretarán de acuerdo con las leyes aplicables, sin tener en cuenta sus disposiciones sobre conflictos de leyes.
            </p>
          </section>

          <section style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>11. Contacto</h2>
            <p>
              Si tienes preguntas sobre estos Términos de Servicio, puedes contactarnos a través de tu cuenta en la plataforma o visitando{' '}
              <a href="https://setterapp.ai" style={{ color: 'var(--color-primary)' }}>setterapp.ai</a>.
            </p>
          </section>

          <section>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              Al utilizar setterapp.ai, confirmas que has leído, entendido y aceptado estos Términos de Servicio y nuestra{' '}
              <Link to="/privacy" style={{ color: 'var(--color-primary)' }}>Política de Privacidad</Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

export default TermsOfService
