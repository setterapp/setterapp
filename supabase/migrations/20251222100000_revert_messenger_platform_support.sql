-- Revert messenger platform/type support (removes 'messenger' from CHECK constraints)
-- Keeps 'facebook' temporarily (feature is disabled but data may exist)

BEGIN;

-- integrations.type
ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_type_check;
ALTER TABLE public.integrations
  ADD CONSTRAINT integrations_type_check
  CHECK (type = ANY (ARRAY['whatsapp'::text, 'instagram'::text, 'google-calendar'::text, 'facebook'::text]));

-- contacts.platform
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_platform_check;
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_platform_check
  CHECK (platform = ANY (ARRAY['whatsapp'::text, 'instagram'::text]));

-- conversations.platform
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_platform_check;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_platform_check
  CHECK (platform = ANY (ARRAY['whatsapp'::text, 'instagram'::text]));

-- agents.platform
ALTER TABLE public.agents DROP CONSTRAINT IF EXISTS agents_platform_check;
ALTER TABLE public.agents
  ADD CONSTRAINT agents_platform_check
  CHECK ((platform = ANY (ARRAY['whatsapp'::text, 'instagram'::text])) OR (platform IS NULL));

COMMIT;
