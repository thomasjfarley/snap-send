-- Migration 001: Initial schema for Snap Send
-- Run this in Supabase SQL Editor or via supabase db push

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  full_name           text not null default '',
  email               text not null default '',
  personal_address_id uuid,  -- FK added after addresses table
  created_at          timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- ADDRESSES
-- ─────────────────────────────────────────
create table public.addresses (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  label        text not null default 'Home',
  full_name    text not null,
  line1        text not null,
  line2        text,
  city         text not null,
  state        text not null,
  zip          text not null,
  country      text not null default 'US',
  lob_verified boolean not null default false,
  is_personal  boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Add FK from profiles → addresses now that addresses exists
alter table public.profiles
  add constraint fk_personal_address
  foreign key (personal_address_id) references public.addresses(id) on delete set null;

-- ─────────────────────────────────────────
-- POSTCARDS
-- Images are NOT stored. Metadata only.
-- ─────────────────────────────────────────
create table public.postcards (
  id                         uuid primary key default uuid_generate_v4(),
  user_id                    uuid not null references public.profiles(id) on delete cascade,
  message                    text not null default '',
  frame                      text not null default 'none',
  filter                     text not null default 'none',
  from_address_id            uuid references public.addresses(id) on delete set null,
  to_address_id              uuid references public.addresses(id) on delete set null,
  recipient_snapshot         jsonb not null default '{}',
  status                     text not null default 'pending'
                               check (status in ('pending','paid','submitted','mailed','failed')),
  lob_id                     text,
  stripe_payment_intent_id   text,
  price_cents                int not null default 399,
  created_at                 timestamptz not null default now(),
  mailed_at                  timestamptz
);

-- ─────────────────────────────────────────
-- ORDERS
-- ─────────────────────────────────────────
create table public.orders (
  id                         uuid primary key default uuid_generate_v4(),
  user_id                    uuid not null references public.profiles(id) on delete cascade,
  postcard_id                uuid not null references public.postcards(id) on delete cascade,
  stripe_payment_intent_id   text not null,
  amount_cents               int not null,
  status                     text not null default 'pending'
                               check (status in ('pending','succeeded','failed')),
  created_at                 timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────
create index idx_addresses_user_id    on public.addresses(user_id);
create index idx_postcards_user_id    on public.postcards(user_id);
create index idx_postcards_status     on public.postcards(status);
create index idx_orders_user_id       on public.orders(user_id);
create index idx_orders_postcard_id   on public.orders(postcard_id);

-- ─────────────────────────────────────────
-- AUTO-CREATE PROFILE ON SIGN-UP
-- ─────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
