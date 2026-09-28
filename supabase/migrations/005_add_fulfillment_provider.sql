-- Generalize Lob-specific fulfillment fields so PostGrid can be introduced
-- without losing historical Lob order data.

alter table public.addresses
  add column if not exists address_verified boolean not null default false,
  add column if not exists verification_provider text,
  add column if not exists verified_at timestamptz;

update public.addresses
set
  address_verified = lob_verified,
  verification_provider = case when lob_verified then 'lob' else null end,
  verified_at = case when lob_verified then created_at else null end
where address_verified = false;

alter table public.postcards
  add column if not exists fulfillment_provider text not null default 'lob',
  add column if not exists provider_id text,
  add column if not exists provider_status text,
  add column if not exists provider_preview_url text,
  add column if not exists provider_live boolean;

update public.postcards
set
  fulfillment_provider = 'lob',
  provider_id = lob_id,
  provider_status = status,
  provider_preview_url = coalesce(lob_front_url, lob_back_url)
where provider_id is null and lob_id is not null;

create unique index if not exists idx_postcards_provider_order
  on public.postcards (fulfillment_provider, provider_id)
  where provider_id is not null;

create unique index if not exists idx_postcards_payment_intent
  on public.postcards (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

