/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_GOOGLE_CLIENT_SECRET: string
  readonly VITE_INSTAGRAM_APP_ID?: string
  readonly VITE_INSTAGRAM_APP_SECRET?: string
  readonly VITE_INSTAGRAM_REDIRECT_URI?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
