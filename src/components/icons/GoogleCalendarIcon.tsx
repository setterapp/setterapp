import { Calendar } from 'lucide-react'

interface GoogleCalendarIconProps {
  size?: number
  color?: string
}

export default function GoogleCalendarIcon({ size = 24, color = '#000' }: GoogleCalendarIconProps) {
  return <Calendar size={size} color={color} strokeWidth={2} />
}














