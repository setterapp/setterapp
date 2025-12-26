-- Create availability_debug_logs table for debugging meeting scheduling
-- This table stores all inputs/outputs from check-availability and schedule-meeting

create table if not exists availability_debug_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Function info
  function_name text not null, -- 'check-availability' or 'schedule-meeting'

  -- Request/Response
  request_body jsonb,
  response_body jsonb,
  response_status int,

  -- Context
  user_id text,
  conversation_id text,
  agent_id text,

  -- Error tracking
  error_message text
);

-- Index for faster queries
create index if not exists availability_debug_logs_created_at_idx
  on availability_debug_logs(created_at desc);

create index if not exists availability_debug_logs_user_id_idx
  on availability_debug_logs(user_id);

create index if not exists availability_debug_logs_function_name_idx
  on availability_debug_logs(function_name);

-- RLS Policies
alter table availability_debug_logs enable row level security;

-- Drop existing policies first for idempotency
drop policy if exists "Users can view their own debug logs" on availability_debug_logs;
drop policy if exists "Service role has full access" on availability_debug_logs;

-- Service role can do everything (for edge functions)
create policy "Service role has full access"
  on availability_debug_logs
  for all
  using (true)
  with check (true);
