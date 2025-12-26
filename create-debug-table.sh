#!/bin/bash

# One-liner to create the debug table
# Run this: ./create-debug-table.sh

echo "Creating availability_debug_logs table..."

supabase db query << 'ENDSQL'
create table if not exists availability_debug_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  function_name text not null,
  request_body jsonb not null,
  response_body jsonb not null,
  response_status int not null,
  user_id uuid,
  conversation_id uuid,
  agent_id uuid,
  error_message text,
  constraint availability_debug_logs_function_name_check
    check (function_name in ('check-availability', 'schedule-meeting'))
);

create index if not exists availability_debug_logs_created_at_idx on availability_debug_logs(created_at desc);
create index if not exists availability_debug_logs_user_id_idx on availability_debug_logs(user_id);
alter table availability_debug_logs enable row level security;
ENDSQL

echo "✅ Done! Table created successfully."
