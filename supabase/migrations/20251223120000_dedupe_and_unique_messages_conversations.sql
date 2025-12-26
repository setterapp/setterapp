-- Deduplicar conversaciones y mensajes de Instagram y prevenir duplicados a futuro
-- Motivación:
-- - Instagram/Meta puede reenviar eventos o enviarlos en múltiples formatos => inserts duplicados
-- - Sin constraints únicos, terminamos con 2+ rows para el mismo sender/message_id

-- 1) Merge de conversaciones duplicadas: dejamos 1 conversación por (user_id, platform, platform_conversation_id)
--    y re-point de mensajes al conversation_id canónico antes de borrar duplicados.
WITH ranked_conversations AS (
  SELECT
    id,
    user_id,
    platform,
    platform_conversation_id,
    FIRST_VALUE(id) OVER (
      PARTITION BY user_id, platform, platform_conversation_id
      ORDER BY created_at ASC, id ASC
    ) AS keep_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, platform, platform_conversation_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.conversations
),
dups AS (
  SELECT id AS dup_id, keep_id
  FROM ranked_conversations
  WHERE rn > 1
)
UPDATE public.messages m
SET conversation_id = d.keep_id
FROM dups d
WHERE m.conversation_id = d.dup_id;

WITH ranked_conversations AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, platform, platform_conversation_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.conversations
)
DELETE FROM public.conversations c
USING ranked_conversations r
WHERE c.id = r.id AND r.rn > 1;

-- 2) Deduplicar mensajes: dejar 1 por (user_id, platform_message_id)
WITH ranked_messages AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, platform_message_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.messages
)
DELETE FROM public.messages m
USING ranked_messages r
WHERE m.id = r.id AND r.rn > 1;

-- 3) Constraints únicos para prevenir duplicados a futuro
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversations_user_platform_platform_conversation_id_key'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_user_platform_platform_conversation_id_key
      UNIQUE (user_id, platform, platform_conversation_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_user_platform_message_id_key'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_user_platform_message_id_key
      UNIQUE (user_id, platform_message_id);
  END IF;
END $$;
