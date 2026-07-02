-- Enable the pg_cron extension (may already be enabled, this is idempotent).
-- Note: pg_cron must be enabled in the Supabase dashboard under
--   Database → Extensions → pg_cron  BEFORE running this migration.
create extension if not exists pg_cron with schema extensions;

-- Grant cron usage to the postgres role.
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Schedule a no-op query every 5 days to keep the free-tier project active.
-- Supabase pauses projects after ~7 days of inactivity; 5 days is safely under that.
-- Cron expression: at 03:00 on day-of-month 1, 6, 11, 16, 21, 26, 31
select cron.schedule(
  'keepalive-ping',         -- job name (unique)
  '0 3 */5 * *',            -- every 5 days at 03:00 UTC
  $$select 1$$             -- lightweight no-op
);
