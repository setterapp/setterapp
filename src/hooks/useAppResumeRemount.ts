import { useEffect, useRef, useState } from 'react'

/**
 * Fuerza un "soft reload" del UI (remount de la ruta actual) cuando la app vuelve
 * del background. Esto resuelve casos donde la DB responde pero React queda en
 * un estado "stuck" y no re-renderiza correctamente.
 */
export function useAppResumeRemount() {
  const [outletKey, setOutletKey] = useState(0)
  const lastBumpAtRef = useRef(0)

  useEffect(() => {
    const onResume = (evt: Event) => {
      const now = Date.now()
      // Debounce para evitar storms (focus + visibilitychange)
      if (now - lastBumpAtRef.current < 1000) return
      lastBumpAtRef.current = now

      const custom = evt as CustomEvent<{ timeHiddenMs?: number; reason?: string }>
      const timeHiddenMs = custom.detail?.timeHiddenMs ?? 0

      // Si hubo background real, remount. (0s puede venir de focus spam)
      if (timeHiddenMs >= 1000) {
        setOutletKey((k) => k + 1)
      }
    }

    window.addEventListener('appsetter:supabase-resume', onResume as EventListener)
    return () => window.removeEventListener('appsetter:supabase-resume', onResume as EventListener)
  }, [])

  return outletKey
}


