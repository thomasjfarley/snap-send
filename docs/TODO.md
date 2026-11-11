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
- [ ] **Request-an-address feature** (spec agreed, not built): sender creates the postcard, enters the recipient email on the payment screen, pays, and the recipient is emailed a link (Resend). Link is valid 45 days. The recipient opens a web page (`snap-send-web`), previews and can download the postcard, enters their address, and the address is saved to the sender's address book and the card is sent. Reminders: if the link is unopened or no address is entered at 7, 15 and 30 days, re-email the recipient and email the sender to ask them to remind the recipient to check spam. At 45 days with no address, refund the sender. Needs: token table, scheduled job (pg_cron or scheduled edge function), public page, save-address function, abuse limits. Payment is charged immediately at pay time; refund at day 45 if no address. Tracking: record link clicks ourselves (token page load) and email opens/clicks via Resend webhooks (email.opened, email.clicked); opens are unreliable (Apple Mail privacy), so treat the link click as the source of truth.
