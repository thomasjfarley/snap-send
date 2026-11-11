-- Accounts that pay Lob's cost instead of the standard price (family/internal).
-- Separate from profiles because users can update their own profile row.
CREATE TABLE IF NOT EXISTS public.at_cost_accounts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.at_cost_accounts ENABLE ROW LEVEL SECURITY;

-- The app only needs to know whether the signed-in user is listed; no write policies
CREATE POLICY "Users can view own at-cost row"
  ON public.at_cost_accounts FOR SELECT
  USING (auth.uid() = user_id);

INSERT INTO public.at_cost_accounts (user_id) VALUES
  ('c1590a7e-bd26-48b2-b925-dc4895910ddc'),
  ('98a9db62-9bee-4af0-b38d-6ab44b5bb91b'),
  ('797bf03a-9178-4c46-880c-bed3b7449480')
ON CONFLICT DO NOTHING;
