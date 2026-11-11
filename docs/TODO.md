# Snap Send TODO

Shared task list for any session or contributor. Keep it current: add new items, remove or check off finished ones.

## Open

- [ ] **Enable R8 minification on Android** (deadline Feb 2027; start before January).
  Play Console flags DEX obfuscation at 1% (needs 25%+). Add an `android` block to the `expo-build-properties` plugin in `app.json` with `enableMinifyInReleaseBuilds: true` and `enableShrinkResourcesInReleaseBuilds: true`. R8 can strip code that Firebase, Stripe or Supabase need, so test an internal-track release build on a device (sign in, send a postcard, pay, analytics) before promoting to production.
- [ ] **Decide on Apple sign-in for the web app** (`snap-send-web`, `auth.service.ts` uses `signInWithOAuth`).
  The Apple OAuth client secret in Supabase (Authentication > Providers > Apple) expires every 6 months. Native iOS sign-in does not use it. Options: remove Apple on web, or automate secret renewal. First count users with Apple as their provider (hidden-email users cannot sign in on web without it).
- [ ] **Confirm Android 1.0.8 is live on Google Play.** Upload with `scripts/play-upload.js` (git-ignored, uses gcloud ADC, quota project `snap-send-491401`). Play rejects builds that include the AD_ID permission, so it is blocked in `app.json` `android.blockedPermissions`.
- [ ] **Fix `monitor-store-releases` Apple 401** (GitHub issue #11): re-check the App Store Connect API key and `APPLE_*` secrets in Supabase.
- [ ] **Review Android 17 (API 37) policies** before targeting it: location declaration (deadline Jan 27, 2027) and contacts permissions (`expo-location`, `expo-contacts`).
- [ ] **Consider raising the 500-character message limit** and revisit the 60-emoji cap (Lob HTML limit is 10,000 characters).
- [ ] **Email customers on in-app refunds** (the webhook path already emails on Lob failures).
- [ ] **Request-an-address feature:** a user emails someone (the recipient) a link; the recipient opens a web page, enters their address, previews the postcard, can download it, and the submitted address is saved to the sender's address book. Needs design: token/link table, public page in `snap-send-web`, edge function to save the address, expiry and abuse limits, email send via Resend.
