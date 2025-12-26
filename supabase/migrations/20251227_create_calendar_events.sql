-- Tabla para almacenar eventos del calendario sincronizados desde Google Calendar
-- Esto permite que la IA consulte disponibilidad sin llamar a Google Calendar API cada vez

create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Relación con usuario
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Datos del evento de Google Calendar
  google_event_id text not null, -- ID del evento en Google Calendar
  summary text, -- Título del evento
  description text,

  -- Fecha y hora
  start_time timestamptz not null, -- Hora de inicio (UTC)
  end_time timestamptz not null, -- Hora de fin (UTC)

  -- Metadata
  is_all_day boolean default false,
  status text default 'confirmed', -- confirmed, cancelled, tentative

  -- Para tracking
  last_synced_at timestamptz default now(),

  -- Constraints
  constraint calendar_events_user_google_unique unique(user_id, google_event_id)
);

-- Índices para queries rápidas
create index calendar_events_user_id_idx on calendar_events(user_id);
create index calendar_events_start_time_idx on calendar_events(start_time);
create index calendar_events_user_start_idx on calendar_events(user_id, start_time);

-- RLS Policies
alter table calendar_events enable row level security;

-- Users can only see their own events
create policy "Users can view their own calendar events"
  on calendar_events
  for select
  using (auth.uid() = user_id);

-- Service role has full access (for sync functions)
create policy "Service role has full access to calendar events"
  on calendar_events
  for all
  using (true)
  with check (true);

-- Función para actualizar updated_at automáticamente
create or replace function update_calendar_events_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger calendar_events_updated_at
  before update on calendar_events
  for each row
  execute function update_calendar_events_updated_at();
