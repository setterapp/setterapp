BEGIN;

-- Stores debug payloads for the Facebook OAuth -> Page token exchange flow.
-- IMPORTANT: Do not store secrets/tokens here. Payloads should be sanitized in the Edge Function.

CREATE TABLE IF NOT EXISTS public.facebook_oauth_debug_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  stage text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS facebook_oauth_debug_events_user_id_created_at_idx
  ON public.facebook_oauth_debug_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS facebook_oauth_debug_events_request_id_idx
  ON public.facebook_oauth_debug_events (request_id);

ALTER TABLE public.facebook_oauth_debug_events ENABLE ROW LEVEL SECURITY;

-- Read own debug events
DROP POLICY IF EXISTS "facebook_oauth_debug_events_select_own" ON public.facebook_oauth_debug_events;
CREATE POLICY "facebook_oauth_debug_events_select_own"
  ON public.facebook_oauth_debug_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow authenticated clients to insert only their own rows (Edge Functions with service role bypass RLS anyway)
DROP POLICY IF EXISTS "facebook_oauth_debug_events_insert_own" ON public.facebook_oauth_debug_events;
CREATE POLICY "facebook_oauth_debug_events_insert_own"
  ON public.facebook_oauth_debug_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

COMMIT;


