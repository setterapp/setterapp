import { X } from 'lucide-react'
import { useEffect } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="flex justify-between items-center" style={{ padding: 'var(--spacing-xl)', paddingBottom: 'var(--spacing-lg)', borderBottom: '2px solid #000', flexShrink: 0 }}>
            <h2 className="text-xl font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="btn btn--ghost btn--sm"
            >
              <X size={20} />
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
