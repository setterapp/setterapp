-- =============================================
-- UPDATE RLS POLICIES FOR TEAM-BASED ACCESS
-- Changes from user_id based to team_id based policies
-- =============================================

-- Drop existing policies and recreate with team_id

-- 1. SUBSCRIPTIONS
DROP POLICY IF EXISTS "Users can view their own subscription" ON subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscription" ON subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscription" ON subscriptions;
DROP POLICY IF EXISTS "Service role can manage all subscriptions" ON subscriptions;

CREATE POLICY "Team members can view subscription"
  ON subscriptions FOR SELECT
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Owners can manage subscription"
  ON subscriptions FOR ALL
  USING (team_id = get_user_team_id() AND is_team_owner())
  WITH CHECK (team_id = get_user_team_id() AND is_team_owner());

CREATE POLICY "Service role can manage all subscriptions"
  ON subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. CONVERSATIONS
DROP POLICY IF EXISTS "Users can view their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON conversations;

CREATE POLICY "Team members can view conversations"
  ON conversations FOR SELECT
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can insert conversations"
  ON conversations FOR INSERT
  WITH CHECK (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can update conversations"
  ON conversations FOR UPDATE
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can delete conversations"
  ON conversations FOR DELETE
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

-- 3. CONTACTS
DROP POLICY IF EXISTS "Users can view their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON contacts;

CREATE POLICY "Team members can view contacts"
  ON contacts FOR SELECT
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can insert contacts"
  ON contacts FOR INSERT
  WITH CHECK (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can update contacts"
  ON contacts FOR UPDATE
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can delete contacts"
  ON contacts FOR DELETE
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

-- 4. INTEGRATIONS (Owner/Admin only for modifications)
DROP POLICY IF EXISTS "Users can view their own integrations" ON integrations;
DROP POLICY IF EXISTS "Users can insert their own integrations" ON integrations;
DROP POLICY IF EXISTS "Users can update their own integrations" ON integrations;
DROP POLICY IF EXISTS "Users can delete their own integrations" ON integrations;

CREATE POLICY "Team members can view integrations"
  ON integrations FOR SELECT
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team managers can insert integrations"
  ON integrations FOR INSERT
  WITH CHECK ((team_id = get_user_team_id() AND can_manage_team()) OR user_id = auth.uid());

CREATE POLICY "Team managers can update integrations"
  ON integrations FOR UPDATE
  USING ((team_id = get_user_team_id() AND can_manage_team()) OR user_id = auth.uid());

CREATE POLICY "Team managers can delete integrations"
  ON integrations FOR DELETE
  USING ((team_id = get_user_team_id() AND can_manage_team()) OR user_id = auth.uid());

-- 5. AGENTS
DROP POLICY IF EXISTS "Users can view their own agents" ON agents;
DROP POLICY IF EXISTS "Users can insert their own agents" ON agents;
DROP POLICY IF EXISTS "Users can update their own agents" ON agents;
DROP POLICY IF EXISTS "Users can delete their own agents" ON agents;

CREATE POLICY "Team members can view agents"
  ON agents FOR SELECT
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can insert agents"
  ON agents FOR INSERT
  WITH CHECK (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can update agents"
  ON agents FOR UPDATE
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can delete agents"
  ON agents FOR DELETE
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

-- 6. KNOWLEDGE_BASES
DROP POLICY IF EXISTS "Users can view their own knowledge bases" ON knowledge_bases;
DROP POLICY IF EXISTS "Users can insert their own knowledge bases" ON knowledge_bases;
DROP POLICY IF EXISTS "Users can update their own knowledge bases" ON knowledge_bases;
DROP POLICY IF EXISTS "Users can delete their own knowledge bases" ON knowledge_bases;

CREATE POLICY "Team members can view knowledge bases"
  ON knowledge_bases FOR SELECT
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can insert knowledge bases"
  ON knowledge_bases FOR INSERT
  WITH CHECK (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can update knowledge bases"
  ON knowledge_bases FOR UPDATE
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can delete knowledge bases"
  ON knowledge_bases FOR DELETE
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

-- 7. MEETINGS
DROP POLICY IF EXISTS "Users can view their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can insert their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can delete their own meetings" ON meetings;

CREATE POLICY "Team members can view meetings"
  ON meetings FOR SELECT
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can insert meetings"
  ON meetings FOR INSERT
  WITH CHECK (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can update meetings"
  ON meetings FOR UPDATE
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can delete meetings"
  ON meetings FOR DELETE
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

-- 8. INSTAGRAM_POSTS
DROP POLICY IF EXISTS "Users can view their own posts" ON instagram_posts;
DROP POLICY IF EXISTS "Users can insert their own posts" ON instagram_posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON instagram_posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON instagram_posts;

CREATE POLICY "Team members can view posts"
  ON instagram_posts FOR SELECT
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can insert posts"
  ON instagram_posts FOR INSERT
  WITH CHECK (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can update posts"
  ON instagram_posts FOR UPDATE
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can delete posts"
  ON instagram_posts FOR DELETE
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

-- 9. COMMENT_AUTOMATIONS
DROP POLICY IF EXISTS "Users can view their own automations" ON comment_automations;
DROP POLICY IF EXISTS "Users can insert their own automations" ON comment_automations;
DROP POLICY IF EXISTS "Users can update their own automations" ON comment_automations;
DROP POLICY IF EXISTS "Users can delete their own automations" ON comment_automations;

CREATE POLICY "Team members can view automations"
  ON comment_automations FOR SELECT
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can insert automations"
  ON comment_automations FOR INSERT
  WITH CHECK (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can update automations"
  ON comment_automations FOR UPDATE
  USING (team_id = get_user_team_id() OR user_id = auth.uid());

CREATE POLICY "Team members can delete automations"
  ON comment_automations FOR DELETE
  USING (team_id = get_user_team_id() OR user_id = auth.uid());
