-- Add context field to contacts table for AI long-term memory
-- This field stores important information the AI learns about the lead
-- Examples: name, what they're looking for, objections, preferred times, etc.

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS context TEXT DEFAULT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN contacts.context IS 'AI memory field - stores important information about the lead gathered during conversations (name, interests, objections, schedule preferences, etc.)';
