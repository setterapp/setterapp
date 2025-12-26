BEGIN;

-- Allow 'facebook' integration rows (needed to store page_access_token/page_id/etc)
ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_type_check;
ALTER TABLE public.integrations
  ADD CONSTRAINT integrations_type_check
  CHECK (
    type = ANY (
      ARRAY[
        'whatsapp'::text,
        'instagram'::text,
        'facebook'::text,
        'google-calendar'::text
      ]
    )
  );

COMMIT;


