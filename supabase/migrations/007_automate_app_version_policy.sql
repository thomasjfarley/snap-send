alter table public.app_version_policy
  add column if not exists minimum_build_number bigint,
  add column if not exists latest_build_number bigint;

update public.app_version_policy
set
  minimum_build_number = case platform
    when 'ios' then 26
    when 'android' then 16
  end,
  latest_build_number = case platform
    when 'ios' then 26
    when 'android' then 16
  end
where minimum_build_number is null
   or latest_build_number is null;

alter table public.app_version_policy
  alter column minimum_build_number set not null,
  alter column latest_build_number set not null;

create table public.store_release_observations (
  platform text primary key check (platform in ('ios', 'android')),
  candidate_version text,
  candidate_build_number bigint,
  first_observed_at timestamptz,
  last_observed_at timestamptz,
  observation_count integer not null default 0,
  enforced_at timestamptz,
  checked_at timestamptz,
  last_error text
);

alter table public.store_release_observations enable row level security;

insert into public.store_release_observations (platform)
values ('ios'), ('android');

create extension if not exists pg_net with schema extensions;
