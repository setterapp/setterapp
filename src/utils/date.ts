// Helper function to format dates
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 1) return 'Hoy'
  if (diffDays === 1) return 'Hace 1 día'
  if (diffDays < 30) return `Hace ${diffDays} días`
  if (diffDays < 60) return 'Hace 1 mes'
  if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} meses`
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatFullDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}


