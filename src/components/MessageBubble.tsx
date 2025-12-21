import type { Message } from '../hooks/useMessages'
import { formatDate } from '../utils/date'
import WhatsAppIcon from './icons/WhatsAppIcon'
import InstagramIcon from './icons/InstagramIcon'

interface MessageBubbleProps {
  message: Message
  platform: 'whatsapp' | 'instagram'
}

export default function MessageBubble({ message, platform }: MessageBubbleProps) {
  const isInbound = message.direction === 'inbound'
  const PlatformIcon = platform === 'whatsapp' ? WhatsAppIcon : InstagramIcon

  return (
    <div className={`message-wrapper message-wrapper--${message.direction}`}>
      <div className={`message-bubble message-bubble--${message.direction}`}>
        {isInbound && (
          <div className="message-avatar">
            <PlatformIcon size={20} />
          </div>
        )}
        <div className="message-content">
          <div className="message-text">{message.content}</div>
          <div className="message-timestamp">{formatDate(message.created_at)}</div>
        </div>
      </div>
    </div>
  )
}
