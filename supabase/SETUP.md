# Supabase Setup Guide

Follow these steps to connect Snap Send to your Supabase project.

## 1. Create a Supabase project
1. Go to https://supabase.com and sign in
2. Click **New project**, name it `snap-send`
3. Choose a strong database password and save it
4. Select a region close to your users

## 2. Run the database migrations
In Supabase dashboard → **SQL Editor**, run the following files in order:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`

## 3. Configure Auth providers
In Supabase dashboard → **Authentication → Providers**:

### Email (enabled by default)
- Enable "Confirm email" for production
- For development you can disable it to skip email verification

### Google
1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` as an authorized redirect URI
4. Copy Client ID and Client Secret into Supabase → Auth → Providers → Google

### Apple
1. You need an Apple Developer account for this
2. Follow the [Supabase Apple OAuth guide](https://supabase.com/docs/guides/auth/social-login/auth-apple)
3. Can be set up later — defer until Phase 10

## 4. Get your project keys
In Supabase dashboard → **Settings → API**:
- Copy **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
- Copy **anon/public key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Copy **service_role key** → used as `SUPABASE_SERVICE_ROLE_KEY` in Edge Function secrets (never in the app)

Add to `.env.local`:
```
EXPO_PUBLIC_SUPABASE_URL=https://XXXX.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## 5. Set Edge Function secrets
In Supabase dashboard → **Edge Functions → Secrets** (or use the CLI):
```sh
npx supabase secrets set LOB_API_KEY=your_lob_api_key
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_...
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
npx supabase secrets set GOOGLE_VISION_API_KEY=AIza...
npx supabase secrets set LOB_WEBHOOK_SECRET=your_lob_webhook_secret
```

## 6. Deploy Edge Functions
```sh
npx supabase functions deploy validate-address
npx supabase functions deploy create-payment-intent
npx supabase functions deploy submit-postcard
npx supabase functions deploy postcard-webhook
npx supabase functions deploy stripe-webhook
```

## 7. Register webhooks
- **Lob.com:** Dashboard → Settings → Webhooks → Add endpoint:
  `https://YOUR_PROJECT_REF.supabase.co/functions/v1/postcard-webhook`
- **Stripe:** Dashboard → Developers → Webhooks → Add endpoint:
  `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`
  Events to listen for: `payment_intent.payment_failed`

## 8. Regenerate TypeScript types (optional but recommended)
After running migrations:
```sh
npx supabase gen types typescript --project-id YOUR_PROJECT_REF > lib/database.types.ts
```
