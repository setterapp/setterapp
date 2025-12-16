-- Add lead_status column to conversations table
-- This column will be used to track the lead status (cold, warm, hot)
-- Will be set by AI agents in the future

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS lead_status TEXT CHECK (lead_status IN ('cold', 'warm', 'hot')) DEFAULT NULL;

-- Add index for better query performance when filtering by lead_status
CREATE INDEX IF NOT EXISTS idx_conversations_lead_status ON conversations(lead_status);

-- Add comment to document the column
COMMENT ON COLUMN conversations.lead_status IS 'Lead status set by AI agents: cold (not interested), warm (interested), hot (ready to convert)';
