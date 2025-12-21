-- Habilitar Realtime para las tablas conversations y messages
-- Esto permite que las actualizaciones se reflejen en tiempo real en la aplicación

DO $$
BEGIN
  -- Habilitar Realtime para la tabla conversations si no está ya habilitado
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  END IF;

  -- Habilitar Realtime para la tabla messages si no está ya habilitado
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END $$;

-- Comentarios para documentar
COMMENT ON TABLE conversations IS 'Tabla de conversaciones con Realtime habilitado para actualizaciones en tiempo real';
COMMENT ON TABLE messages IS 'Tabla de mensajes con Realtime habilitado para actualizaciones en tiempo real';
