type DebugLevel = 'log' | 'warn' | 'error'

function isDebugEnabled() {
  try {
    return localStorage.getItem('appsetter_debug') === '1'
  } catch {
    return false
  }
}

export function dbg(level: DebugLevel, message: string, ...args: any[]) {
  if (!isDebugEnabled()) return
  const prefix = `[appsetter][${level}]`
  // eslint-disable-next-line no-console
  ;(console[level] ?? console.log)(prefix, message, ...args)
}

export function installGlobalDebugHooks() {
  if (!isDebugEnabled()) return

  dbg('log', 'Debug enabled (localStorage appsetter_debug=1)')

  window.addEventListener('error', (e) => {
    dbg('error', 'window.error', e.error ?? e.message)
  })
  window.addEventListener('unhandledrejection', (e) => {
    dbg('error', 'unhandledrejection', (e as PromiseRejectionEvent).reason)
  })

  document.addEventListener('visibilitychange', () => {
    dbg('log', `visibilitychange -> ${document.visibilityState}`)
  })
  window.addEventListener('focus', () => dbg('log', 'window.focus'))
  window.addEventListener('blur', () => dbg('log', 'window.blur'))
  window.addEventListener('online', () => dbg('log', 'window.online'))
  window.addEventListener('offline', () => dbg('warn', 'window.offline'))

  window.addEventListener('appsetter:supabase-resume', (e: Event) => {
    const ce = e as CustomEvent<any>
    dbg('log', 'event appsetter:supabase-resume', ce.detail)
  })

  const describeTarget = (t: EventTarget | null) => {
    if (!(t instanceof Element)) return String(t)
    const id = t.id ? `#${t.id}` : ''
    const cls = t.className && typeof t.className === 'string'
      ? `.${t.className.split(' ').filter(Boolean).slice(0, 3).join('.')}`
      : ''
    return `${t.tagName.toLowerCase()}${id}${cls}`
  }

  const onPointerDown = (e: PointerEvent) => {
    dbg('log', `pointerdown ${e.button}`, {
      target: describeTarget(e.target),
      path0: describeTarget((e.composedPath?.() ?? [])[0] as any),
    })
  }
  const onClick = (e: MouseEvent) => {
    dbg('log', 'click', { target: describeTarget(e.target) })
  }

  // Capture phase para detectar overlays que “se comen” los clicks
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('click', onClick, true)
}


