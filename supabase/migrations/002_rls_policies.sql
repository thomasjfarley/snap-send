-- Migration 002: Row Level Security policies
-- Every table is private by default; users can only access their own data.

-- ─────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ─────────────────────────────────────────
-- ADDRESSES
-- ─────────────────────────────────────────
alter table public.addresses enable row level security;

create policy "Users can view own addresses"
  on public.addresses for select
  using (auth.uid() = user_id);

create policy "Users can insert own addresses"
  on public.addresses for insert
  with check (auth.uid() = user_id);

create policy "Users can update own addresses"
  on public.addresses for update
  using (auth.uid() = user_id);

create policy "Users can delete own addresses"
  on public.addresses for delete
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- POSTCARDS
-- ─────────────────────────────────────────
alter table public.postcards enable row level security;

create policy "Users can view own postcards"
  on public.postcards for select
  using (auth.uid() = user_id);

create policy "Users can insert own postcards"
  on public.postcards for insert
  with check (auth.uid() = user_id);

-- Updates handled only by Edge Functions (service role bypasses RLS)
-- No direct client update/delete on postcards

-- ─────────────────────────────────────────
-- ORDERS
-- ─────────────────────────────────────────
alter table public.orders enable row level security;

create policy "Users can view own orders"
  on public.orders for select
  using (auth.uid() = user_id);

-- Inserts and updates handled only by Edge Functions (service role)
