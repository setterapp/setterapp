import { createClient, type SupabaseClient } from '@supabase/supabase-js'

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
    worker: true,
    // Intentos de reconexión más agresivos
    timeout: 20000,
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
} as const

function createSupabaseClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, clientOptions)
}

// Importers reciben un "live binding": si reseteamos el cliente, todos verán el nuevo.
export let supabase: SupabaseClient = createSupabaseClient()

export async function resetSupabaseClient(reason: string) {
  const oldClient = supabase
  try {
    await oldClient.removeAllChannels()
  } catch {
    // best-effort
  }
  try {
    oldClient.realtime.disconnect()
  } catch {
    // best-effort
  }

  supabase = createSupabaseClient()
  console.warn(`♻️ Supabase client reseteado (${reason})`)
  return supabase
}
