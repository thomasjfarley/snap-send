create table public.store_release_monitor_state (
  singleton boolean primary key default true check (singleton),
  last_started_at timestamptz
);

alter table public.store_release_monitor_state enable row level security;

insert into public.store_release_monitor_state (singleton)
values (true);

create or replace function public.claim_store_release_monitor_run()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_rows integer;
begin
  update public.store_release_monitor_state
  set last_started_at = now()
  where singleton = true
    and (
      last_started_at is null
      or last_started_at <= now() - interval '10 minutes'
    );

  get diagnostics claimed_rows = row_count;
  return claimed_rows = 1;
end;
$$;

revoke all on function public.claim_store_release_monitor_run() from public, anon, authenticated;
grant execute on function public.claim_store_release_monitor_run() to service_role;
