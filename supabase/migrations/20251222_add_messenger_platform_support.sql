-- Allow Messenger across platform/type checks
-- (integrations.type, contacts.platform, conversations.platform, agents.platform)

ALTER TABLE public.integrations
  DROP CONSTRAINT IF EXISTS integrations_type_check,
  ADD CONSTRAINT integrations_type_check
    CHECK (type = ANY (ARRAY['whatsapp'::text, 'instagram'::text, 'messenger'::text, 'google-calendar'::text]));

ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_platform_check,
  ADD CONSTRAINT contacts_platform_check
    CHECK (platform = ANY (ARRAY['whatsapp'::text, 'instagram'::text, 'messenger'::text]));

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_platform_check,
  ADD CONSTRAINT conversations_platform_check
    CHECK (platform = ANY (ARRAY['whatsapp'::text, 'instagram'::text, 'messenger'::text]));

ALTER TABLE public.agents
  DROP CONSTRAINT IF EXISTS agents_platform_check,
  ADD CONSTRAINT agents_platform_check
    CHECK (((platform = ANY (ARRAY['whatsapp'::text, 'instagram'::text, 'messenger'::text])) OR (platform IS NULL)));


