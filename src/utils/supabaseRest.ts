import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../lib/supabase'

type RestMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export async function supabaseRest<T>(
  pathAndQuery: string,
  opts: {
    method?: RestMethod
    accessToken?: string | null
    body?: any
    signal?: AbortSignal
    prefer?: string
  } = {}
): Promise<T> {
  const method = opts.method ?? 'GET'
  const url = `${SUPABASE_URL}${pathAndQuery}`

  const token = opts.accessToken || SUPABASE_ANON_KEY

  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
  }

  if (opts.prefer) headers.Prefer = opts.prefer
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(url, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Supabase REST ${res.status} ${method} ${pathAndQuery} ${text}`)
  }

  // 204 no content
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}


