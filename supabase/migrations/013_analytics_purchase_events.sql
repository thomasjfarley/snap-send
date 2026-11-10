-- Tracks which verified Stripe payments were reported to GA4 so webhook retries never double-count.
CREATE TABLE IF NOT EXISTS public.analytics_purchase_events (
  stripe_payment_intent_id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Service role only (edge functions); no client access
ALTER TABLE public.analytics_purchase_events ENABLE ROW LEVEL SECURITY;
