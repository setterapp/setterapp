-- Tabla para guardar los requests de API para debugging
CREATE TABLE IF NOT EXISTS api_request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    platform TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    headers JSONB,
    body JSONB,
    response_status INTEGER,
    response_body JSONB,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index para buscar por usuario y plataforma
CREATE INDEX IF NOT EXISTS idx_api_request_logs_user_platform ON api_request_logs(user_id, platform, created_at DESC);

-- RLS
ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;

-- Policy para que usuarios vean solo sus logs
CREATE POLICY "Users can view own api logs" ON api_request_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Policy para que el service role pueda insertar
CREATE POLICY "Service role can insert api logs" ON api_request_logs
    FOR INSERT WITH CHECK (true);
