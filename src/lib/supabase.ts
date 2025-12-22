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
    // If detectSessionInUrl=true on that route, Supabase tries to exchange the Instagram `code` as if it were a Supabase OAuth code,
    // causing flow_state errors and breaking Instagram direct OAuth.
    //
    // So we disable it ONLY for the Instagram direct callback route.
    detectSessionInUrl: typeof window !== 'undefined'
      ? !window.location.pathname.startsWith('/auth/instagram/callback')
      : true,
    // Alineado con el proyecto enecc (más estable en Safari/Chrome en background)
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'supabase.auth.token',
    flowType: 'pkce' as const,
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, clientOptions)
