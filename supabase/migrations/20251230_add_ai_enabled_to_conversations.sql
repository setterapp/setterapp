-- Add ai_enabled field to conversations table
-- Defaults to true (AI is enabled by default)
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN conversations.ai_enabled IS 'Whether AI auto-reply is enabled for this conversation';
