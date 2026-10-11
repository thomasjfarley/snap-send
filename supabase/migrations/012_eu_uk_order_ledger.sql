create table public.eu_uk_order_ledger (
  id uuid primary key default gen_random_uuid(),
  stripe_payment_intent_id text not null unique,
  stripe_tax_transaction_id text,
  user_id uuid references public.profiles(id) on delete set null,
  billing_country text not null check (
    billing_country in (
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE',
      'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT',
      'RO', 'SK', 'SI', 'ES', 'SE', 'GB'
    )
  ),
  destination_country text not null,
  currency text not null,
  base_amount_cents integer not null check (base_amount_cents >= 0),
  tax_amount_cents integer not null check (tax_amount_cents >= 0),
  gross_amount_cents integer not null check (gross_amount_cents >= 0),
  livemode boolean not null,
  paid_at timestamptz not null,
  order_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.eu_uk_order_refunds (
  stripe_refund_id text primary key,
  stripe_payment_intent_id text not null references public.eu_uk_order_ledger(
    stripe_payment_intent_id
  ) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null,
  status text not null,
  livemode boolean not null,
  refunded_at timestamptz not null,
  refund_date date not null,
  created_at timestamptz not null default now()
);

create index eu_uk_order_ledger_country_date_idx
  on public.eu_uk_order_ledger (billing_country, order_date);

create index eu_uk_order_refunds_payment_intent_idx
  on public.eu_uk_order_refunds (stripe_payment_intent_id);

alter table public.eu_uk_order_ledger enable row level security;
alter table public.eu_uk_order_refunds enable row level security;

create view public.eu_uk_orders_by_country_date
with (security_invoker = true)
as
with refund_totals as (
  select
    stripe_payment_intent_id,
    sum(amount_cents) filter (where status = 'succeeded')::bigint
      as refunded_amount_cents
  from public.eu_uk_order_refunds
  group by stripe_payment_intent_id
)
select
  ledger.billing_country,
  ledger.order_date,
  count(*)::bigint as order_count,
  sum(ledger.base_amount_cents)::bigint as base_amount_cents,
  sum(ledger.tax_amount_cents)::bigint as tax_amount_cents,
  sum(ledger.gross_amount_cents)::bigint as gross_amount_cents,
  sum(coalesce(refunds.refunded_amount_cents, 0))::bigint as refunded_amount_cents,
  sum(
    ledger.gross_amount_cents - coalesce(refunds.refunded_amount_cents, 0)
  )::bigint as net_amount_cents
from public.eu_uk_order_ledger as ledger
left join refund_totals as refunds
  on refunds.stripe_payment_intent_id = ledger.stripe_payment_intent_id
group by ledger.billing_country, ledger.order_date;
