#!/bin/bash

# Script para crear la tabla calendar_events
# Run: chmod +x create-calendar-events-table.sh && ./create-calendar-events-table.sh

echo "Creating calendar_events table..."

supabase db query << 'ENDSQL'
create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null,
  google_event_id text not null,
  summary text,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  is_all_day boolean default false,
  status text default 'confirmed',
  last_synced_at timestamptz default now(),
  constraint calendar_events_user_google_unique unique(user_id, google_event_id)
);

create index if not exists calendar_events_user_id_idx on calendar_events(user_id);
create index if not exists calendar_events_start_time_idx on calendar_events(start_time);
create index if not exists calendar_events_user_start_idx on calendar_events(user_id, start_time);

alter table calendar_events enable row level security;

drop policy if exists "Users can view their own calendar events" on calendar_events;
create policy "Users can view their own calendar events"
  on calendar_events for select
  using (auth.uid() = user_id);

drop policy if exists "Service role has full access to calendar events" on calendar_events;
create policy "Service role has full access to calendar events"
  on calendar_events for all
  using (true) with check (true);
ENDSQL

echo "✅ Done! Table created successfully."
