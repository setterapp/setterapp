import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

const clientOptions = {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    // El worker ayuda a que el socket no muera en segundo plano
    worker: false,
    // Intentos de reconexión más agresivos
    timeout: 20000,
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // IMPORTANT:
    // We have a non-Supabase OAuth callback at `/auth/instagram/callback` which includes `?code=...`.
    // If detectSessionInUrl=true, Supabase tries to exchange that Instagram code as if it were a Supabase OAuth code,
    // causing 404/flow_state errors and breaking the Instagram direct OAuth flow.
    // We instead handle Supabase OAuth exchange manually in `/auth/callback`.
    detectSessionInUrl: false,
    // Alineado con el proyecto enecc (más estable en Safari/Chrome en background)
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'supabase.auth.token',
    flowType: 'pkce' as const,
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, clientOptions)
