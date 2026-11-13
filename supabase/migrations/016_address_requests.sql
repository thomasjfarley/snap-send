-- Migration 016: "Request an address by email".
-- The sender pays up front and emails the recipient a link. The recipient previews the card,
-- may download it, and enters their address, which triggers printing. All writes happen in
-- Edge Functions (service role); owners may only read their own rows.

create table public.address_requests (
  id                        uuid primary key default uuid_generate_v4(),
  -- Unguessable link token (the only credential the recipient has)
  token                     text not null unique,
  user_id                   uuid not null references public.profiles(id) on delete cascade,
  recipient_email           text not null,
  -- Chosen by the sender at request time; fixes the price and the allowed address country
  international             boolean not null default false,
  from_address_id           uuid references public.addresses(id) on delete set null,
  message                   text not null default '',
  frame                     text not null default 'none',
  filter                    text not null default 'none',
  location                  text,
  stripe_payment_intent_id  text not null unique,
  amount_cents              int not null,
  test_mode                 boolean not null default false,
  status                    text not null default 'awaiting_address'
                              check (status in (
                                'awaiting_address',  -- paid, waiting for the recipient
                                'processing',        -- address received, printing in progress
                                'fulfilled',         -- address received and postcard sent to Lob
                                'expired_digital',   -- 45 days, no address, but the card was downloaded (no refund)
                                'refunded'           -- 45 days with no address and no download, or printing failed
                              )),
  expires_at                timestamptz not null,
  first_viewed_at           timestamptz,
  downloaded_at             timestamptz,
  address_submitted_at      timestamptz,
  reminders_sent            smallint not null default 0,
  last_reminder_at          timestamptz,
  to_address_id             uuid references public.addresses(id) on delete set null,
  postcard_id               uuid references public.postcards(id) on delete set null,
  print_attempts            smallint not null default 0,
  resolved_at               timestamptz,
  images_deleted_at         timestamptz,
  created_at                timestamptz not null default now()
);

create index idx_address_requests_user_id on public.address_requests(user_id);
create index idx_address_requests_status  on public.address_requests(status);

alter table public.address_requests enable row level security;

create policy "Users can view own address requests"
  on public.address_requests for select
  using (auth.uid() = user_id);

alter table public.postcards
  add column address_request_id uuid references public.address_requests(id) on delete set null;

-- Private bucket for the card images (original photo + rendered digital front).
-- Only the service role reads or writes; recipients get short-lived signed URLs from Edge Functions.
insert into storage.buckets (id, name, public)
values ('address-request-images', 'address-request-images', false)
on conflict (id) do nothing;

-- Daily sweep: reminders on days 7, 15 and 30, and the day-45 refund or expiry.
do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job where jobname = 'process-address-requests';
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

select cron.schedule(
  'process-address-requests',
  '0 16 * * *',
  $$
  select net.http_post(
    url := 'https://vetjizijsqclmklevrap.supabase.co/functions/v1/process-address-requests',
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
