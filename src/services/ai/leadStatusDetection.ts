/**
 * Lead Status Types and Utilities
 * Lead status is now managed manually by the user through the UI
 */

export type LeadStatus = 'cold' | 'warm' | 'booked' | 'closed' | 'not_closed'

/**
 * Determines if the lead is qualified for scheduling a meeting
 * A lead is qualified if they are in 'booked' status
 */
export function isLeadQualifiedForMeeting(status: LeadStatus): boolean {
  return status === 'booked'
}

/**
 * Gets the display color for a lead status
 */
export function getLeadStatusColor(status: LeadStatus | null): string | null {
  if (!status) return null
  switch (status) {
    case 'cold':
      return '#94a3b8' // gray/secondary
    case 'warm':
      return '#fbbf24' // yellow/warning
    case 'booked':
      return '#ef4444' // red/hot
    case 'closed':
      return '#22c55e' // green/success
    case 'not_closed':
      return '#ef4444' // red/danger
    default:
      return null
  }
}

/**
 * Gets the display label for a lead status
 */
export function getLeadStatusLabel(status: LeadStatus): string {
  const labels: Record<LeadStatus, string> = {
    cold: 'Cold',
    warm: 'Warm',
    booked: 'Booked',
    closed: 'Closed',
    not_closed: 'Not Closed'
  }
  return labels[status] || status
}
