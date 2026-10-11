alter table public.store_release_observations
  add column consecutive_error_count integer not null default 0;
