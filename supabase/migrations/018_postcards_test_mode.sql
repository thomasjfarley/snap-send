-- Lets the app keep dev (Stripe/Lob test mode) postcards out of live order history and vice versa.
-- Existing rows default to live; submit-postcard sets this for every new postcard.
alter table public.postcards
  add column if not exists test_mode boolean not null default false;
