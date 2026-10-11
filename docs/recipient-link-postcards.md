# Recipient-Link Postcards

Status: Product specification for future implementation  
Last updated: October 11, 2026

## Purpose

Allow a sender to purchase and digitally deliver a full-quality postcard when
they do not know the recipient's mailing address. The recipient can view and
download the postcard through a secure 14-day link and may optionally submit an
address for the included physical postcard.

This document is the durable source of truth for the agreed product behavior,
privacy rules, preview lifecycle, and implementation plan.

## Purchase and destination tiers

Before payment, the sender chooses:

- **USA** - current domestic postcard price.
- **International or Not Sure** - current international postcard price.

USA requests accept only a US physical-delivery address. International or Not
Sure requests may accept any destination supported by Snap Send, including the
US. The international tier is also the convenience tier when the sender does
not know the exact destination country.

The sender is purchasing:

1. Digital delivery of a full-quality postcard.
2. One optional physical postcard if the recipient submits an acceptable
   address during the 14-day link window.

The sender is charged before the digital link is created.

## Delivery choices

For a USA request, the sender may choose:

- SMS to a validated US `+1` phone number.
- Email.
- Share it themselves using the native share sheet or Copy Link.

For an International or Not Sure request, the sender may choose:

- Email.
- Share it themselves using the native share sheet or Copy Link.

The native share sheet may use Messages, WhatsApp, Facebook Messenger, Signal,
Telegram, email, or any other installed application.

All channels point to the same underlying postcard request. Sharing or copying
the link does not extend its expiration and does not by itself mark the order
delivered.

## Link behavior

- The recipient URL is tied directly to one paid postcard.
- It expires 14 days after successful payment and link creation.
- It contains no recipient personal information.
- It uses a cryptographically secure, non-enumerable credential.
- Social and messaging previews must be generic Snap Send branding and must not
  expose the postcard image, message, recipient name, or address.
- Link scanners and email security crawlers must not count as recipient claims.
- The page initially requires an explicit **View Your Postcard** action.
- The full-quality postcard is loaded only after that action.
- The recipient may revisit, view, and download the postcard until expiration.
- Opening the link does not consume or invalidate it.
- Address submission does not end digital access.

Order history provides **Copy Link** and **Share Again** throughout the original
14-day window, including after an address is submitted. After expiration, those
actions are disabled and display **Link Expired**.

## Recipient-claim detection

IP address alone is not a reliable identity because of shared household
networks, carrier NAT, VPNs, and Apple Private Relay.

Use combined signals:

1. Authenticated sender views in checkout and order history never claim the
   postcard.
2. If the recipient URL opens in the app, compare the authenticated account to
   the sender.
3. Use sender account/device context as the primary exclusion signal.
4. Use a short-lived salted hash of the sender's recent IP only as supporting
   evidence.
5. Do not retain raw IP addresses for this purpose.
6. An explicit View action from an unidentified recipient context counts as a
   claim.

Copying or manually sharing the recipient link does not automatically count as
delivery. A sender opening the recipient URL should not claim it when the
combined signals identify the sender.

## Address collection

The recipient can finalize an address only once.

### Verification flow

1. Recipient enters an address.
2. Recipient selects **Verify Address**.
3. Snap Send calls Lob domestic verification or International AV, as applicable.
4. Handle the result:

| Result | Behavior |
|---|---|
| Verified as entered | Mark verified and enable **Submit for Physical Delivery** |
| Verified with corrections | Show entered and Lob-standardized addresses and let the recipient choose |
| Limited international validation | Show delivery-risk warning with **Send Anyway** and **Update Address** |
| Undeliverable | Block submission and offer only **Update Address** |

The recipient may edit and retry until an address is successfully verified or
conditionally accepted. Once they select **Submit for Physical Delivery** or
the permitted **Send Anyway** action:

- Save an immutable address snapshot.
- Permanently lock address submission for that request.
- Automatically submit the physical postcard to Lob.
- Save the finalized address in the sender's address book.
- Avoid creating an exact normalized duplicate.
- Do not allow later address-book edits to change the Lob submission.

The page must disclose:

> Submitting shares this mailing address with [sender name] and saves it to
> their Snap Send address book.

Drafts, failed verification attempts, and addresses that were verified but not
finally submitted are not saved to the sender's address book.

## Preview lifecycle

### Existing implementation

The current checkout preview is a live React Native composition in
`app/postcard/preview.tsx`. It is not captured or persisted.

The client creates a 1875x1275 JPEG from the selected photo and sends its base64
data plus the selected filter, frame, message, and location to
`submit-postcard`.

`submit-postcard`:

1. Applies the filter, frame, print compensation, and location badge.
2. Temporarily uploads the front JPEG to the public `postcard-fronts` bucket.
3. Gives that URL to Lob.
4. Deletes the temporary file immediately after Lob responds.
5. Stores Lob's returned medium thumbnail URLs in `lob_front_url` and
   `lob_back_url`.

Order history reads Lob's URLs directly. Snap Send does not download or retain
Lob's preview files.

### Required recipient-link behavior

- Generate canonical full-quality Snap Send front and back assets on the
  backend.
- Do not use a low-resolution screenshot of the React Native preview.
- Store one compressed canonical copy of each required side in private cloud
  storage.
- Do not create permanent device-storage copies.
- Do not store duplicate checkout, recipient, and order-history copies.
- Generate thumbnails dynamically rather than storing separate thumbnail files
  where practical.

Before address submission, the back contains the message, sender information,
branding, and an empty physical-destination area.

After final address submission:

- Leave the front unchanged.
- Regenerate the Snap Send back with the immutable accepted recipient address.
- Cache-bust or version the replacement so the recipient sees it immediately.
- Continue serving the Snap Send version through the recipient link.

The 14-day recipient link always uses Snap Send's full-quality digital assets,
even after Lob produces its physical proof.

Sender order history uses:

- Snap Send's preview while waiting for an address and Lob processing.
- Lob's existing API preview URLs after Lob thumbnails become available.
- No downloaded or duplicated Lob asset.

For a physically fulfilled order, delete Snap Send's stored assets only after:

1. Lob's preview is available for order history, and
2. The recipient's 14-day link has expired.

For a digital-only order, retain Snap Send's preview for one year, then delete
it and show **Preview no longer available** in order history.

The recipient's explicit Download action may save a local copy. Otherwise,
Snap Send relies on normal temporary image caching only.

### Lob thumbnail timing

Lob thumbnails may be asynchronous. The existing
`postcard.rendered_thumbnails` webhook currently updates only status. The
implementation must retrieve the latest Lob postcard when that event arrives,
persist the thumbnail URLs, switch sender order history to Lob's preview, and
schedule Snap Send asset cleanup after link expiration.

## Order statuses

| Event | Sender-facing status |
|---|---|
| Payment succeeds and delivery is initiated | Awaiting Recipient |
| Recipient claims the postcard | Delivered Digitally / Awaiting Address |
| Recipient submits an acceptable address | Printing |
| Lob fulfillment progresses | Printing -> In Transit -> Processed for Delivery -> Delivered |
| Claimed postcard expires without an address | Delivered Digitally |
| SMS/email hard-fails | Delivery Failed |
| Link expires without a recipient claim | See open refund decision below |

Internally preserve the fulfillment outcome:

- `digital_only`
- `physical`

Do not imply that a physical postcard was delivered when only the digital
postcard was claimed.

## Delivery failures, reminders, and refunds

Provider delivery means only that an SMS carrier or email server accepted the
message. It does not prove inbox placement or human viewing.

Required behavior:

- Track SMS delivered, undeliverable, and failed events.
- Track email delivered, bounced, rejected, and complained events.
- Let the sender correct failed contact information and resend.
- Keep all retries within the original 14-day window.
- Notify the sender when delivery fails.
- Remind the sender when the postcard remains unclaimed.
- Permit the sender to copy/share the link as a fallback.

### Open product decision

The recommended policy is:

- Once a recipient claims the postcard, payment is nonrefundable whether or not
  an address is submitted.
- If no recipient claims the postcard by the end of 14 days, automatically
  refund the sender.

This recommendation addresses spam-folder and failed-engagement fairness, but
the automatic unclaimed-refund rule has not yet been explicitly finalized.
Finalize it before implementing checkout terms and expiration processing.

## Email deliverability

No provider can guarantee placement in every inbox. Snap Send must implement
all reasonable transactional-email safeguards before relying on international
email delivery.

Infrastructure:

- SPF.
- DKIM.
- DMARC alignment and aggregate reporting.
- Dedicated transactional sending subdomain.
- Custom return-path/bounce domain.
- Custom tracking domain if click tracking is enabled.
- Separation from marketing traffic.
- Google Postmaster Tools.
- Microsoft SNDS/JMRP where available.
- Bounce and complaint suppression.

Message construction:

- Branded HTML and plain-text versions.
- Clear Snap Send identity and sender name.
- Explain why the recipient received the message.
- One recognizable `snapsend.live` call-to-action URL.
- No full-resolution attachment.
- Balanced text and imagery.
- Accessible markup.
- No URL shorteners.
- Avoid misleading urgency, spam-oriented language, excessive punctuation, and
  image-only layouts.
- Include support and business identity.

Test real Gmail, Outlook/Hotmail, iCloud, Yahoo, and Proton inboxes before
launch. Microsoft acceptance is not proof of inbox placement.

## SMS delivery

SMS is available only for USA requests and validated US `+1` numbers.

Requirements:

- SMS provider such as Twilio or Telnyx.
- A2P 10DLC registration.
- E.164 normalization.
- Transactional message content.
- Delivery webhooks.
- Rate limits by sender, account, phone number, and IP.
- Resend abuse prevention.
- Keep content within one GSM-7 SMS segment where practical.

International requests use email or sender-managed sharing rather than
international SMS.

## Privacy and legal updates

Update Terms of Service to cover:

- Digital delivery plus optional physical fulfillment.
- The 14-day address and download window.
- Claim-based refund and nonrefund rules.
- Contact accuracy and sender responsibility.
- Confidential bearer links.
- Email/SMS limitations and inbox-placement disclaimers.
- Address finality and automatic Lob fulfillment.
- Limited-validation delivery risk.
- Supported destination tier and pricing behavior.

Update Privacy Policy to cover:

- Recipient phone/email received from the sender.
- Delivery, bounce, rejection, claim, download, and expiration events.
- Short-lived hashed IP/device signals used to distinguish sender views.
- Recipient-submitted addresses.
- Sharing finalized addresses with the sender and saving them in the address
  book.
- SMS/email providers, Lob, Supabase, and Stripe.
- Contact, token, event-log, and preview retention periods.
- Privacy requests from recipients who do not have accounts.

The public page must include a concise privacy disclosure and links to the full
Terms and Privacy Policy before final address submission.

## Security requirements

- High-entropy, non-enumerable recipient access.
- Store only hashed or cryptographically protected credentials.
- No personal data in URLs.
- Private preview storage.
- Strict authorization for sender order-history access.
- Scanner-safe claim action.
- Atomic one-time address submission.
- Idempotent Lob fulfillment.
- Idempotent payment and refund handling.
- CSRF and replay protections.
- Rate limits by account, token, contact destination, and IP.
- Audit events for sends, failures, claims, downloads, address submission,
  sharing, fulfillment, expiration, and refunds.
- Delete previews and contact data according to the documented lifecycle.

## Proposed data model

Add or extend records for:

- Recipient-link request and sender.
- Destination tier (`usa` or `international`).
- Delivery channel (`sms`, `email`, or `manual_share`).
- Normalized phone/email destination.
- Secure token metadata and expiration.
- Provider message IDs and delivery state.
- Human claim timestamp and classification signals.
- Address-verification result.
- Immutable submitted address snapshot.
- Digital preview storage paths and retention deadline.
- Lob preview URLs.
- Fulfillment outcome (`digital_only` or `physical`).
- Reminder, expiration, and refund state.

Do not expose these records through public table policies. Recipient operations
must go through narrowly scoped Edge Functions that validate the bearer
credential and request state.

## Implementation sequence

1. Finalize the unclaimed-postcard refund rule.
2. Audit and repair domain authentication and Microsoft deliverability.
3. Select/register the US SMS provider.
4. Add schema, private storage, RLS, token, event, and cleanup migrations.
5. Add backend canonical front/back rendering.
6. Build payment creation for digital-plus-optional-physical orders.
7. Build SMS/email/manual-share delivery and provider webhooks.
8. Build the public recipient claim/download/address page.
9. Add Lob verification, one-time address locking, sender address-book saving,
   and automatic fulfillment.
10. Extend Lob thumbnail handling without downloading Lob assets.
11. Add expiration, reminders, retention cleanup, and refund jobs.
12. Add native sender checkout, status, Copy Link, Share Again, correction, and
    order-history UI.
13. Update Terms and Privacy Policy.
14. Test claim classification, link scanners, duplicate submissions, payments,
    refunds, email placement, SMS failures, international addresses, Lob
    fulfillment, and storage cleanup.
15. Deploy backend and recipient web flow.
16. Release the native app update.
17. Allow the existing automated store monitor to make the released build
    mandatory.

