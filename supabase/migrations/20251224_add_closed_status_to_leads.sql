-- Add 'closed' status to lead_status column
-- Closed means the lead has been converted or rejected definitively

-- Drop the existing check constraint
ALTER TABLE conversations
DROP CONSTRAINT IF EXISTS conversations_lead_status_check;

-- Re-add the constraint with 'closed' included
ALTER TABLE conversations
ADD CONSTRAINT conversations_lead_status_check
CHECK (lead_status IN ('cold', 'warm', 'hot', 'closed'));

-- Update comment to reflect the new status
COMMENT ON COLUMN conversations.lead_status IS 'Lead status set by AI agents: cold (not interested), warm (interested), hot (ready to convert), closed (converted or definitively rejected)';

-- Also add lead_status to contacts table if it doesn't exist
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS lead_status TEXT CHECK (lead_status IN ('cold', 'warm', 'hot', 'closed')) DEFAULT NULL;

-- Add index for contacts lead_status
CREATE INDEX IF NOT EXISTS idx_contacts_lead_status ON contacts(lead_status);

-- Add comment
COMMENT ON COLUMN contacts.lead_status IS 'Lead status synced from latest conversation: cold, warm, hot, or closed';
