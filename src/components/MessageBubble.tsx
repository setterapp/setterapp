import type { Message } from '../hooks/useMessages'
import { formatDate } from '../utils/date'

interface MessageBubbleProps {
  message: Message
  platform: 'whatsapp' | 'instagram'
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  return (
    <div className={`message-wrapper message-wrapper--${message.direction}`}>
      <div className={`message-bubble message-bubble--${message.direction}`}>
        <div className="message-content">
          <div className="message-text-wrapper">
            <div className="message-text">{message.content}</div>
            <div className="message-timestamp">{formatDate(message.created_at)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
