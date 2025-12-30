-- Knowledge bases table for storing documents that agents can reference
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  file_type TEXT DEFAULT 'text',
  file_size INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own knowledge bases"
  ON knowledge_bases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own knowledge bases"
  ON knowledge_bases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own knowledge bases"
  ON knowledge_bases FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own knowledge bases"
  ON knowledge_bases FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_user_id ON knowledge_bases(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_agent_id ON knowledge_bases(agent_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_knowledge_bases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_knowledge_bases_updated_at ON knowledge_bases;
CREATE TRIGGER trigger_knowledge_bases_updated_at
  BEFORE UPDATE ON knowledge_bases
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_bases_updated_at();
