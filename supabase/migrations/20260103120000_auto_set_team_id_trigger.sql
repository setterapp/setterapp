-- =============================================
-- AUTO-SET team_id TRIGGER
-- Automatically sets team_id based on user_id when inserting records
-- This ensures edge functions don't need modification
-- =============================================

-- First, add team_id to messages table (missing from previous migration)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
CREATE INDEX IF NOT EXISTS idx_messages_team ON messages(team_id);

-- Update existing messages with team_id
UPDATE messages m
SET team_id = (SELECT t.id FROM teams t WHERE t.owner_id = m.user_id LIMIT 1)
WHERE m.team_id IS NULL AND m.user_id IS NOT NULL;

-- Update RLS for messages to include team access
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;

CREATE POLICY "Team members can view messages"
  ON messages FOR SELECT
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can insert messages"
  ON messages FOR INSERT
  WITH CHECK (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can update messages"
  ON messages FOR UPDATE
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can delete messages"
  ON messages FOR DELETE
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

-- Function to get team_id for a user_id
CREATE OR REPLACE FUNCTION get_team_id_for_user(p_user_id UUID)
RETURNS UUID AS $$
  SELECT team_id FROM team_members WHERE user_id = p_user_id LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Generic trigger function to set team_id
CREATE OR REPLACE FUNCTION set_team_id_from_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set team_id if it's NULL and user_id is set
  IF NEW.team_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.team_id := get_team_id_for_user(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for each table

-- Conversations
DROP TRIGGER IF EXISTS set_conversations_team_id ON conversations;
CREATE TRIGGER set_conversations_team_id
  BEFORE INSERT ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION set_team_id_from_user();

-- Contacts
DROP TRIGGER IF EXISTS set_contacts_team_id ON contacts;
CREATE TRIGGER set_contacts_team_id
  BEFORE INSERT ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION set_team_id_from_user();

-- Integrations
DROP TRIGGER IF EXISTS set_integrations_team_id ON integrations;
CREATE TRIGGER set_integrations_team_id
  BEFORE INSERT ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION set_team_id_from_user();

-- Agents
DROP TRIGGER IF EXISTS set_agents_team_id ON agents;
CREATE TRIGGER set_agents_team_id
  BEFORE INSERT ON agents
  FOR EACH ROW
  EXECUTE FUNCTION set_team_id_from_user();

-- Knowledge bases
DROP TRIGGER IF EXISTS set_knowledge_bases_team_id ON knowledge_bases;
CREATE TRIGGER set_knowledge_bases_team_id
  BEFORE INSERT ON knowledge_bases
  FOR EACH ROW
  EXECUTE FUNCTION set_team_id_from_user();

-- Meetings
DROP TRIGGER IF EXISTS set_meetings_team_id ON meetings;
CREATE TRIGGER set_meetings_team_id
  BEFORE INSERT ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION set_team_id_from_user();

-- Instagram posts
DROP TRIGGER IF EXISTS set_instagram_posts_team_id ON instagram_posts;
CREATE TRIGGER set_instagram_posts_team_id
  BEFORE INSERT ON instagram_posts
  FOR EACH ROW
  EXECUTE FUNCTION set_team_id_from_user();

-- Comment automations
DROP TRIGGER IF EXISTS set_comment_automations_team_id ON comment_automations;
CREATE TRIGGER set_comment_automations_team_id
  BEFORE INSERT ON comment_automations
  FOR EACH ROW
  EXECUTE FUNCTION set_team_id_from_user();

-- Subscriptions (only on insert, owner creates)
DROP TRIGGER IF EXISTS set_subscriptions_team_id ON subscriptions;
CREATE TRIGGER set_subscriptions_team_id
  BEFORE INSERT ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_team_id_from_user();

-- Messages
DROP TRIGGER IF EXISTS set_messages_team_id ON messages;
CREATE TRIGGER set_messages_team_id
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION set_team_id_from_user();
