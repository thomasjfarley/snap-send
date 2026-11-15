-- Recipient's name typed by the sender when requesting an address by email; used in the invite greeting.
alter table public.address_requests add column if not exists recipient_name text;
