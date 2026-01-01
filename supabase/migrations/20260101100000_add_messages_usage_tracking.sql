-- Add messages_used and messages_reset_at columns to subscriptions table
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS messages_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS messages_reset_at TIMESTAMPTZ DEFAULT NOW();

-- Create RPC function to increment messages_used (only counts outbound/AI messages)
CREATE OR REPLACE FUNCTION increment_messages_used(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE subscriptions
  SET messages_used = COALESCE(messages_used, 0) + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_messages_used(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_messages_used(UUID) TO service_role;
