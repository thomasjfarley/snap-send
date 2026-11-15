-- Optional "send from" name typed by the sender; used in emails, the recipient page and the printed card.
alter table public.address_requests add column if not exists sender_name text;
