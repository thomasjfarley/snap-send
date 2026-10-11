do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'monitor-store-releases';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

select cron.schedule(
  'monitor-store-releases',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://vetjizijsqclmklevrap.supabase.co/functions/v1/monitor-store-releases',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'store_monitor_publishable_key'
      ),
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'store_monitor_publishable_key'
      )
    ),
    body := '{"source":"cron"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
