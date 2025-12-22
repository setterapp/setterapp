import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

const DEFAULT_FETCH_TIMEOUT_MS = 15000

function createTimedFetch(timeoutMs: number): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    // Encadenar abort externo si llega un signal
    const externalSignal = init?.signal
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort()
      else externalSignal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    try {
      return await fetch(input, { ...(init ?? {}), signal: controller.signal })
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

const clientOptions = {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    // El worker ayuda a que el socket no muera en segundo plano
    // NOTA: en algunos navegadores/entornos el worker puede causar flapping del WS al volver del background.
    // Preferimos estabilidad de fetch + re-subscribe desde hooks.
    worker: false,
    // Intentos de reconexión más agresivos
    timeout: 20000,
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Alineado con el proyecto enecc (más estable en Safari/Chrome en background)
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'supabase.auth.token',
    flowType: 'pkce' as const,
  },
  global: {
    // Evita requests colgados (causa típica del “se queda cargando” sin errores)
    fetch: createTimedFetch(DEFAULT_FETCH_TIMEOUT_MS),
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, clientOptions)

/**
 * Recovery best-effort SIN recrear el cliente (evita "Multiple GoTrueClient instances").
 * Evita manipular el WebSocket manualmente (puede provocar "closed before established").
 */
export async function resetSupabaseClient(reason: string) {
  try {
    await supabase.auth.refreshSession()
  } catch {
    // best-effort
  }

  console.warn(`♻️ Supabase recovery ejecutado (${reason})`)
  return supabase
}
