create table if not exists public.app_version_policy (
  platform text primary key check (platform in ('ios', 'android')),
  minimum_version text not null,
  latest_version text not null,
  message text not null default 'A new version of Snap Send is required to continue.',
  store_url text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_version_policy enable row level security;

grant select on table public.app_version_policy to anon, authenticated;

create policy "Anyone can read app version policy"
  on public.app_version_policy
  for select
  using (true);

insert into public.app_version_policy (
  platform,
  minimum_version,
  latest_version,
  store_url
)
values
  (
    'ios',
    '1.0.5',
    '1.0.5',
    'https://apps.apple.com/app/id6762068752'
  ),
  (
    'android',
    '1.0.5',
    '1.0.5',
    'https://play.google.com/store/apps/details?id=com.snapsend.live'
  )
on conflict (platform) do nothing;
