-- Create function_logs table to store Edge Function execution logs
CREATE TABLE IF NOT EXISTS function_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Function identification
    function_name TEXT NOT NULL,
    execution_id TEXT,

    -- Context
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,

    -- Log details
    level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'debug')),
    message TEXT NOT NULL,
    step TEXT, -- e.g., 'Step 1: Conversation loaded'

    -- Additional data
    metadata JSONB DEFAULT '{}'::jsonb,
    error_details JSONB,

    -- Performance tracking
    duration_ms INTEGER
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_function_logs_created_at ON function_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_function_logs_function_name ON function_logs(function_name);
CREATE INDEX IF NOT EXISTS idx_function_logs_user_id ON function_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_function_logs_conversation_id ON function_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_function_logs_level ON function_logs(level);
CREATE INDEX IF NOT EXISTS idx_function_logs_execution_id ON function_logs(execution_id);

-- RLS Policies
ALTER TABLE function_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own logs
DROP POLICY IF EXISTS "Users can view their own function logs" ON function_logs;
CREATE POLICY "Users can view their own function logs"
    ON function_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can insert logs
DROP POLICY IF EXISTS "Service role can insert function logs" ON function_logs;
CREATE POLICY "Service role can insert function logs"
    ON function_logs
    FOR INSERT
    WITH CHECK (true);

-- Service role can view all logs
DROP POLICY IF EXISTS "Service role can view all function logs" ON function_logs;
CREATE POLICY "Service role can view all function logs"
    ON function_logs
    FOR SELECT
    USING (true);

COMMENT ON TABLE function_logs IS 'Stores execution logs from Edge Functions for debugging and monitoring';
COMMENT ON COLUMN function_logs.execution_id IS 'Unique identifier for a single function execution (all logs from one call share this ID)';
COMMENT ON COLUMN function_logs.step IS 'Human-readable step identifier (e.g., Step 1, Step 2)';
COMMENT ON COLUMN function_logs.metadata IS 'Additional structured data (request params, results, etc.)';
