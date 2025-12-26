-- Enable pg_cron extension and create jobs for calendar sync

-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Grant usage to postgres
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Create a job to renew calendar watches daily at 3 AM UTC
-- This ensures watches don't expire (they last 7 days)
select cron.schedule(
  'renew-calendar-watches',
  '0 3 * * *', -- Every day at 3:00 AM UTC
  $$
  select net.http_post(
    url := 'https://afqbakvvfpebnxzjewsk.supabase.co/functions/v1/renew-calendar-watches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Create a backup sync job every 6 hours in case webhook misses events
select cron.schedule(
  'sync-all-calendars',
  '0 */6 * * *', -- Every 6 hours
  $$
  select net.http_post(
    url := 'https://afqbakvvfpebnxzjewsk.supabase.co/functions/v1/sync-calendar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"sync_all": true}'::jsonb
  );
  $$
);

-- View scheduled jobs
-- select * from cron.job;
