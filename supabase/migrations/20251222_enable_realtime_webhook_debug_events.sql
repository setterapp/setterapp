-- Enable Realtime for webhook_debug_events so the frontend can subscribe for debug

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'webhook_debug_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE webhook_debug_events;
  END IF;
END $$;


