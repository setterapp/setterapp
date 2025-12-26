-- Create meetings table to track scheduled meetings with leads
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,

  -- Google Calendar integration
  calendar_event_id TEXT,

  -- Meeting details
  meeting_date TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  meeting_link TEXT,
  lead_name TEXT,
  lead_email TEXT,
  lead_phone TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'scheduled',

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_conversation_id ON meetings(conversation_id);
CREATE INDEX IF NOT EXISTS idx_meetings_agent_id ON meetings(agent_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_meeting_date ON meetings(meeting_date);

-- Enable Row Level Security
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- RLS Policies (with DROP IF EXISTS for idempotency)
DROP POLICY IF EXISTS "Users can view their own meetings" ON meetings;
CREATE POLICY "Users can view their own meetings"
  ON meetings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own meetings" ON meetings;
CREATE POLICY "Users can create their own meetings"
  ON meetings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own meetings" ON meetings;
CREATE POLICY "Users can update their own meetings"
  ON meetings FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own meetings" ON meetings;
CREATE POLICY "Users can delete their own meetings"
  ON meetings FOR DELETE
  USING (auth.uid() = user_id);

-- Service role full access
DROP POLICY IF EXISTS "Service role has full access to meetings" ON meetings;
CREATE POLICY "Service role has full access to meetings"
  ON meetings FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE meetings IS 'Stores scheduled meetings between agents and leads';
