-- Trackable postcard QR code: scans from snapsend.live/q, and the campaign a user installed from.

CREATE TABLE IF NOT EXISTS public.qr_scans (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scanned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  campaign    TEXT NOT NULL DEFAULT 'postcard',
  platform    TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'other')),
  user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS idx_qr_scans_scanned_at ON public.qr_scans(scanned_at);

-- Service role only (edge function); no client access
ALTER TABLE public.qr_scans ENABLE ROW LEVEL SECURITY;

-- Set once on Android from the Play install referrer (see lib/install-referrer.ts)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS install_campaign TEXT,
  ADD COLUMN IF NOT EXISTS install_campaign_at TIMESTAMPTZ;

-- Install-to-first-postcard timing for postcard-sourced users
CREATE OR REPLACE VIEW public.postcard_campaign_funnel
WITH (security_invoker = true) AS
SELECT
  p.id AS user_id,
  p.created_at AS signed_up_at,
  p.install_campaign,
  MIN(pc.created_at) AS first_postcard_at,
  MIN(pc.created_at) - p.created_at AS signup_to_first_postcard,
  COUNT(pc.id) AS postcards_sent
FROM public.profiles p
LEFT JOIN public.postcards pc ON pc.user_id = p.id
WHERE p.install_campaign IS NOT NULL
GROUP BY p.id, p.created_at, p.install_campaign;
