-- Create availability_debug_logs table for debugging meeting scheduling
-- This table stores all inputs/outputs from check-availability and schedule-meeting

create table if not exists availability_debug_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Function info
  function_name text not null, -- 'check-availability' or 'schedule-meeting'

  -- Request/Response
  request_body jsonb not null, -- Input parameters
  response_body jsonb not null, -- Output response
  response_status int not null, -- HTTP status code

  -- Context
  user_id uuid,
  conversation_id uuid,
  agent_id uuid,

  -- Error tracking
  error_message text,

  -- Indexes for querying
  constraint availability_debug_logs_function_name_check
    check (function_name in ('check-availability', 'schedule-meeting'))
);

-- Index for faster queries
create index if not exists availability_debug_logs_created_at_idx
  on availability_debug_logs(created_at desc);

create index if not exists availability_debug_logs_user_id_idx
  on availability_debug_logs(user_id);

create index if not exists availability_debug_logs_conversation_id_idx
  on availability_debug_logs(conversation_id);

-- RLS Policies
alter table availability_debug_logs enable row level security;

-- Users can only see their own debug logs
create policy "Users can view their own debug logs"
  on availability_debug_logs
  for select
  using (auth.uid() = user_id);

-- Service role can do everything (for edge functions)
create policy "Service role has full access"
  on availability_debug_logs
  for all
  using (true)
  with check (true);
