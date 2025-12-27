import { MessageSquare } from 'lucide-react'

export default function EmptyConversation() {
  return (
    <div className="empty-conversation">
      <MessageSquare size={64} style={{ opacity: 0.3, marginBottom: 'var(--spacing-md)' }} />
      <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-text)' }}>
        Select a conversation
      </h3>
      <p style={{ margin: 'var(--spacing-sm) 0 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
        Choose a conversation from the list to view messages
      </p>
    </div>
  )
}
