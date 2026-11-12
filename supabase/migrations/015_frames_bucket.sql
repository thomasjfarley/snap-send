-- Public bucket holding seasonal frame overlay PNGs (assets/frames/*.png).
-- submit-postcard fetches `<frame id>.png` from here to composite onto the print image.
-- Objects are only writable with the service role; public read needs no policy.
insert into storage.buckets (id, name, public)
values ('frames', 'frames', true)
on conflict (id) do nothing;
