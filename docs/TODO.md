# Snap Send TODO

Shared task list for any session or contributor. Keep it current: add new items, remove or check off finished ones.

## Open

- [ ] **Enable R8 minification on Android** (deadline Feb 2027; start before January).
  Play Console flags DEX obfuscation at 1% (needs 25%+). Add an `android` block to the `expo-build-properties` plugin in `app.json` with `enableMinifyInReleaseBuilds: true` and `enableShrinkResourcesInReleaseBuilds: true`. R8 can strip code that Firebase, Stripe or Supabase need, so test an internal-track release build on a device (sign in, send a postcard, pay, analytics) before promoting to production.
- [ ] **Decide on Apple sign-in for the web app** (`snap-send-web`, `auth.service.ts` uses `signInWithOAuth`).
  The Apple OAuth client secret in Supabase (Authentication > Providers > Apple) expires every 6 months. Native iOS sign-in does not use it. Options: remove Apple on web, or automate secret renewal. First count users with Apple as their provider (hidden-email users cannot sign in on web without it).
- [ ] **Add analytics to the web privacy policy** (`snap-send-web/src/app/pages/privacy/privacy.html`). The in-app policy mentions Google Analytics for Firebase; the web page does not.
- [ ] **Submit iOS 1.0.8 build 31 for review** in App Store Connect (not build 30, which is the dev client).
- [ ] **Confirm Android 1.0.8 is live on Google Play.** Upload with `scripts/play-upload.js` (git-ignored, uses gcloud ADC, quota project `snap-send-491401`). Play rejects builds that include the AD_ID permission, so it is blocked in `app.json` `android.blockedPermissions`.
- [ ] **Check Stripe Tax registrations for New York** (Dashboard > Tax > Registrations) for the at-cost accounts; consult a tax advisor.
- [ ] **Confirm Lob's international fee on an invoice** ($1.429 assumed on top of $0.909; at-cost international price is 234 cents).
- [ ] **Fix retry after refund:** Retry reuses the already-refunded PaymentIntent and says contact support. Start a fresh payment instead.
- [ ] **Fix `monitor-store-releases` Apple 401** (GitHub issue #11): re-check the App Store Connect API key and `APPLE_*` secrets in Supabase.
- [ ] **Review Android 17 (API 37) policies** before targeting it: location declaration (deadline Jan 27, 2027) and contacts permissions (`expo-location`, `expo-contacts`).
- [ ] **Consider raising the 500-character message limit** and revisit the 60-emoji cap (Lob HTML limit is 10,000 characters).
- [ ] **Email customers on in-app refunds** (the webhook path already emails on Lob failures).
