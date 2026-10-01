alter table public.postcards
  drop constraint if exists postcards_status_check;

alter table public.postcards
  add constraint postcards_status_check
  check (
    status in (
      'pending',
      'paid',
      'submitted',
      'mailed',
      'in_transit',
      'processed_for_delivery',
      'delivered',
      'failed'
    )
  );

alter table public.postcards
  add column if not exists delivered_at timestamptz;

update public.postcards
set status = 'in_transit'
where status = 'mailed';

