-- =============================================
-- TEAM SYSTEM MIGRATION
-- Transforms single-user model to team-based model
-- =============================================

-- 1. CREATE TEAMS TABLE
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for owner lookup
CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_id);

-- 2. CREATE TEAM_MEMBERS TABLE
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Indexes for team_members
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- 3. CREATE TEAM_INVITATIONS TABLE
CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, email)
);

-- Index for token lookup
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);

-- 4. ADD team_id TO EXISTING TABLES
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE knowledge_bases ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE instagram_posts ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE comment_automations ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);

-- Create indexes for team_id on all tables
CREATE INDEX IF NOT EXISTS idx_subscriptions_team ON subscriptions(team_id);
CREATE INDEX IF NOT EXISTS idx_conversations_team ON conversations(team_id);
CREATE INDEX IF NOT EXISTS idx_contacts_team ON contacts(team_id);
CREATE INDEX IF NOT EXISTS idx_integrations_team ON integrations(team_id);
CREATE INDEX IF NOT EXISTS idx_agents_team ON agents(team_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_team ON knowledge_bases(team_id);
CREATE INDEX IF NOT EXISTS idx_meetings_team ON meetings(team_id);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_team ON instagram_posts(team_id);
CREATE INDEX IF NOT EXISTS idx_comment_automations_team ON comment_automations(team_id);

-- 5. MIGRATE EXISTING DATA
-- Create teams for users who have subscriptions
INSERT INTO teams (id, name, owner_id, created_at)
SELECT
  gen_random_uuid(),
  COALESCE(
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  ) || '''s Team',
  u.id,
  COALESCE(s.created_at, NOW())
FROM auth.users u
INNER JOIN subscriptions s ON s.user_id = u.id
WHERE NOT EXISTS (SELECT 1 FROM teams t WHERE t.owner_id = u.id)
ON CONFLICT DO NOTHING;

-- Also create teams for users who have data but no subscription yet
INSERT INTO teams (id, name, owner_id, created_at)
SELECT
  gen_random_uuid(),
  COALESCE(
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  ) || '''s Team',
  u.id,
  NOW()
FROM auth.users u
WHERE EXISTS (
  SELECT 1 FROM conversations c WHERE c.user_id = u.id
  UNION
  SELECT 1 FROM agents a WHERE a.user_id = u.id
  UNION
  SELECT 1 FROM integrations i WHERE i.user_id = u.id
)
AND NOT EXISTS (SELECT 1 FROM teams t WHERE t.owner_id = u.id)
ON CONFLICT DO NOTHING;

-- Create team_members entries for owners
INSERT INTO team_members (team_id, user_id, role, joined_at)
SELECT t.id, t.owner_id, 'owner', t.created_at
FROM teams t
WHERE NOT EXISTS (
  SELECT 1 FROM team_members tm
  WHERE tm.team_id = t.id AND tm.user_id = t.owner_id
)
ON CONFLICT DO NOTHING;

-- Update subscriptions with team_id
UPDATE subscriptions s
SET team_id = (SELECT t.id FROM teams t WHERE t.owner_id = s.user_id LIMIT 1)
WHERE s.team_id IS NULL;

-- Update conversations with team_id
UPDATE conversations c
SET team_id = (SELECT t.id FROM teams t WHERE t.owner_id = c.user_id LIMIT 1)
WHERE c.team_id IS NULL;

-- Update contacts with team_id
UPDATE contacts ct
SET team_id = (SELECT t.id FROM teams t WHERE t.owner_id = ct.user_id LIMIT 1)
WHERE ct.team_id IS NULL;

-- Update integrations with team_id
UPDATE integrations i
SET team_id = (SELECT t.id FROM teams t WHERE t.owner_id = i.user_id LIMIT 1)
WHERE i.team_id IS NULL;

-- Update agents with team_id
UPDATE agents a
SET team_id = (SELECT t.id FROM teams t WHERE t.owner_id = a.user_id LIMIT 1)
WHERE a.team_id IS NULL;

-- Update knowledge_bases with team_id
UPDATE knowledge_bases kb
SET team_id = (SELECT t.id FROM teams t WHERE t.owner_id = kb.user_id LIMIT 1)
WHERE kb.team_id IS NULL;

-- Update meetings with team_id
UPDATE meetings m
SET team_id = (SELECT t.id FROM teams t WHERE t.owner_id = m.user_id LIMIT 1)
WHERE m.team_id IS NULL;

-- Update instagram_posts with team_id
UPDATE instagram_posts ip
SET team_id = (SELECT t.id FROM teams t WHERE t.owner_id = ip.user_id LIMIT 1)
WHERE ip.team_id IS NULL;

-- Update comment_automations with team_id
UPDATE comment_automations ca
SET team_id = (SELECT t.id FROM teams t WHERE t.owner_id = ca.user_id LIMIT 1)
WHERE ca.team_id IS NULL;

-- 6. CREATE HELPER FUNCTIONS FOR RLS

-- Function to get user's team_id
CREATE OR REPLACE FUNCTION get_user_team_id()
RETURNS UUID AS $$
  SELECT team_id FROM team_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function to get user's role in their team
CREATE OR REPLACE FUNCTION get_user_team_role()
RETURNS TEXT AS $$
  SELECT role FROM team_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function to check if user can manage team (owner or admin)
CREATE OR REPLACE FUNCTION can_manage_team()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Function to check if user is team owner
CREATE OR REPLACE FUNCTION is_team_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE user_id = auth.uid()
    AND role = 'owner'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 7. ENABLE RLS ON NEW TABLES
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- 8. RLS POLICIES FOR TEAMS
CREATE POLICY "Users can view their team"
  ON teams FOR SELECT
  USING (id = get_user_team_id());

CREATE POLICY "Owners can update their team"
  ON teams FOR UPDATE
  USING (id = get_user_team_id() AND is_team_owner());

-- 9. RLS POLICIES FOR TEAM_MEMBERS
CREATE POLICY "Users can view team members"
  ON team_members FOR SELECT
  USING (team_id = get_user_team_id());

CREATE POLICY "Team managers can insert members"
  ON team_members FOR INSERT
  WITH CHECK (team_id = get_user_team_id() AND can_manage_team());

CREATE POLICY "Team managers can update members"
  ON team_members FOR UPDATE
  USING (team_id = get_user_team_id() AND can_manage_team());

CREATE POLICY "Team managers can delete members"
  ON team_members FOR DELETE
  USING (team_id = get_user_team_id() AND can_manage_team());

-- 10. RLS POLICIES FOR TEAM_INVITATIONS
CREATE POLICY "Team managers can view invitations"
  ON team_invitations FOR SELECT
  USING (team_id = get_user_team_id() AND can_manage_team());

CREATE POLICY "Team managers can create invitations"
  ON team_invitations FOR INSERT
  WITH CHECK (team_id = get_user_team_id() AND can_manage_team());

CREATE POLICY "Team managers can delete invitations"
  ON team_invitations FOR DELETE
  USING (team_id = get_user_team_id() AND can_manage_team());

-- Allow anyone to view invitation by token (for accepting)
CREATE POLICY "Anyone can view invitation by token"
  ON team_invitations FOR SELECT
  USING (token IS NOT NULL);

-- Service role bypass for all team tables
CREATE POLICY "Service role has full access to teams"
  ON teams FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to team_members"
  ON team_members FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to team_invitations"
  ON team_invitations FOR ALL
  USING (true)
  WITH CHECK (true);
