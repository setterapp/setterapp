import { useState } from 'react'
import { Key } from 'lucide-react'
import Modal from './common/Modal'

interface IntegrationModalProps {
  isOpen: boolean
  onClose: () => void
  integrationType: 'whatsapp' | 'instagram'
  onConnect: (token: string, phoneNumberId?: string, businessAccountId?: string) => Promise<void>
}

function IntegrationModal({ isOpen, onClose, integrationType, onConnect }: IntegrationModalProps) {
  const [token, setToken] = useState('')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [businessAccountId, setBusinessAccountId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!token.trim()) {
      setError('El token es requerido')
      setLoading(false)
      return
    }

    try {
      await onConnect(
        token.trim(),
        phoneNumberId.trim() || undefined,
        businessAccountId.trim() || undefined
      )
      // Limpiar formulario
      setToken('')
      setPhoneNumberId('')
      setBusinessAccountId('')
      onClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error connecting'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setToken('')
    setPhoneNumberId('')
    setBusinessAccountId('')
    setError(null)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Connect ${
        integrationType === 'whatsapp'
          ? 'WhatsApp Business'
          : 'Instagram'
      }`}
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div
            style={{
              padding: 'var(--spacing-md)',
              background: 'var(--color-danger)',
              color: 'white',
              borderRadius: 'var(--border-radius)',
              marginBottom: 'var(--spacing-md)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="token" className="label">
            <Key size={16} style={{ display: 'inline', marginRight: 'var(--spacing-xs)' }} />
            Access Token
          </label>
          <input
            id="token"
            type="password"
            className="input"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            placeholder={integrationType === 'whatsapp' ? 'EAAxxxxxxxxxxxxx' : 'IGxxxxxxxxxxxxx'}
          />
          <p style={{ margin: 'var(--spacing-xs) 0 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {integrationType === 'whatsapp'
              ? 'WhatsApp Business API permanent access token'
              : 'Instagram Graph API access token'}
          </p>
        </div>

        {integrationType === 'whatsapp' && (
          <div className="form-group">
            <label htmlFor="phoneNumberId" className="label">
              Phone Number ID (Opcional)
            </label>
            <input
              id="phoneNumberId"
              type="text"
              className="input"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="123456789012345"
            />
            <p style={{ margin: 'var(--spacing-xs) 0 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              WhatsApp Business phone number ID
            </p>
          </div>
        )}

        {integrationType === 'instagram' && (
          <div className="form-group">
            <label htmlFor="businessAccountId" className="label">
              Business Account ID (Opcional)
            </label>
            <input
              id="businessAccountId"
              type="text"
              className="input"
              value={businessAccountId}
              onChange={(e) => setBusinessAccountId(e.target.value)}
              placeholder="17841405309211844"
            />
            <p style={{ margin: 'var(--spacing-xs) 0 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Instagram business account ID
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'flex-end', marginTop: 'var(--spacing-lg)' }}>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={loading}>
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default IntegrationModal
