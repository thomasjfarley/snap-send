# EU and UK Store Disclosures

This document is the submission checklist and source text for distributing
Snap Send through Apple App Store and Google Play storefronts in the European
Union and United Kingdom.

Snap Send is free to download. Users purchase a personalized physical
correspondence service through Stripe. Snap Send arranges the creation,
printing, and postal delivery of each postcard. Apple and Google distribute the
app but do not process postcard payments and are not the seller or merchant of
record for postcard orders.

## Information that must be finalized

Do not enable EU storefronts until the following public trader information is
accurate and supported by verification documents:

- Legal seller or trader name: `[LEGAL SELLER NAME]`
- Public trader address or documented P.O. Box: `[PUBLIC TRADER ADDRESS]`
- Public trader phone number: `[PUBLIC TRADER PHONE]`
- Public support email: `support@snapsend.live`
- Support website: `https://snapsend.live`
- Business registration number, if applicable: `[REGISTRATION NUMBER OR N/A]`
- VAT identification number, if registered: `[VAT ID OR NOT REGISTERED]`

The address and phone entered for Apple EU trader verification will be
displayed publicly on EU App Store product pages. Google may also display
verified developer identity and contact information based on account type and
monetization status.

## Apple App Store Connect

### EU Digital Services Act trader declaration

Snap Send should be declared a **trader**. It is a commercial app offering a
paid service for composing, printing, and mailing personalized physical
correspondence.

App Store Connect path:

1. Open **Business**.
2. Under **Agreements**, find **Compliance**.
3. Complete **Digital Services Act** requirements.
4. Select **This is a trader account**.
5. Enter and verify the public address, phone number, and email.
6. Upload current documentation connecting the legal seller to the displayed
   address.
7. Certify that the offered products and services comply with applicable EU
   law.
8. Open **Apps -> Snap Send -> App Information -> App Store Regulations and
   Permits** and confirm that trader status is enabled for Snap Send.

Apple permits a documented P.O. Box for an individual trader. If one is used,
the submitted document must demonstrate the trader's association with it.

The optional **Labels and Markings URL** is not needed unless a specific
product label or marking becomes legally required for the postcard product.

### Apple reviewer notes

Use this text when submitting the release that opens EU/UK availability:

> Snap Send is free to download and provides a paid service for composing,
> printing, and mailing personalized physical correspondence. Postcard
> payments are processed by Stripe because each paid transaction results in
> the production and postal delivery of a physical postcard. No digital
> content, subscription, app functionality, virtual currency, or premium
> feature is unlocked by payment.
>
> The checkout page displays the postcard price in U.S. dollars and any tax
> calculated by Stripe before the user confirms payment. The customer supplies
> a verified sender address and recipient mailing address. Snap Send then
> submits the customized postcard to its printing and postal-fulfillment
> provider.
>
> Apple is not the seller, merchant of record, or payment processor for
> postcard orders. Order support and refunds are handled by Snap Send at
> support@snapsend.live.

### Apple metadata and privacy review

Confirm before enabling EU storefronts:

- Privacy Policy URL points to the current policy.
- Support URL and support email are current.
- App Privacy answers include the data actually collected by Snap Send and its
  service providers:
  - Name and email
  - User ID
  - Sender and recipient physical addresses
  - User photos and postcard messages
  - Purchase history and transaction identifiers
  - Location information if transmitted off-device
  - Diagnostics or usage data if later added
- App Review has an active demo account and the exact username
  `support@snapsend.live`.

## Google Play Console

### Developer verification and public contact information

Google does not currently document a separate Play Console DSA trader toggle
equivalent to Apple's form. Complete the general developer-account verification
and treat Snap Send as a commercial trader for public-contact purposes.

Verify:

- Legal name and address in the linked Google Payments profile.
- Private contact email and phone are verified for Google's use.
- Public developer email is `support@snapsend.live`.
- Public support phone and address are entered where Play Console makes those
  fields available.
- The per-app support contact under **Grow users -> Store presence -> Store
  settings** is current.
- Any new trader-status prompt shown in the live Play Console is completed as a
  trader before EU availability is enabled.

### Google Play transaction explanation

Use this text in policy-review responses or other reviewer instructions:

> Snap Send is free to download. Users pay only for the service of composing,
> printing, and mailing personalized physical correspondence. Each transaction
> results in a physical postcard being produced and delivered through postal
> services. Stripe processes the payment. The purchase does not unlock digital
> content, app functionality, subscriptions, virtual currency, or other
> digital goods.

Google Play Billing must not be used for purchases of physical goods and
physical services. Snap Send's correspondence service falls within this
category because payment results in a printed postcard being physically mailed.
Continue using Stripe only for that transaction. Any future digital-only
product or premium app feature must be reviewed separately under Google Play's
Payments policy.

### Google Data Safety

Review **Policy and programs -> App content -> Data safety** and ensure the
answers match production behavior.

Expected disclosures include:

| Data category | Snap Send use | Handling |
|---|---|---|
| Name and email | Account, order support, authentication | Collected |
| Physical address | Sender, recipient, printing and delivery | Collected and shared with fulfillment providers |
| Photos | Personalized postcard production | Collected and shared with fulfillment providers |
| User-generated content | Postcard message and optional location text | Collected and shared for fulfillment |
| User ID | Account and order association | Collected |
| Purchase history | Orders, refunds, support and compliance | Collected |
| Payment data | Processed by Stripe; Snap Send does not receive full card data | Service-provider processing |

The Data Safety form must link to the current Privacy Policy and accurately
describe the in-app account-deletion mechanism.

### Google country availability

Country targeting is managed under **Production -> Countries/regions**. If EU
distribution is opened, avoid arbitrary nationality- or residence-based
restrictions. Operational restrictions remain acceptable when a destination is
unsupported by fulfillment, sanctions, postal suspension, payment processing,
or another objective legal limitation.

## UK distribution

Neither Apple nor Google currently documents a separate UK trader-verification
form comparable to Apple's EU DSA process. Use the same seller identity,
support contacts, pricing disclosure, physical correspondence and store-payment
explanation, and consumer-rights language for UK customers.

Before UK availability:

- Ensure the legal seller name, postal address, email, and phone are available
  to customers.
- Display the complete price before payment.
- State that prices are in U.S. dollars and banks may charge conversion fees.
- Preserve non-waivable UK consumer rights.
- Explain that personalized printed correspondence may be excluded from
  cancellation or withdrawal rights once production begins.
- Keep transaction and refund records by billing country and date.

## Store-listing transaction disclosure

Add this paragraph to the full App Store and Google Play description when
EU/UK distribution opens:

> Snap Send is free to download. Users pay individually for personalized
> correspondence to be printed as a physical postcard and delivered through
> postal services, with the complete price shown before payment. Payments are
> processed securely by Stripe, and Snap Send does not store full card details.
> Apple and Google do not process postcard payments or provide printing,
> delivery, refund, or order-support services.

## Release checklist

1. Complete Apple DSA trader verification and app-specific trader status.
2. Confirm Google developer identity and public support information.
3. Replace every placeholder in this document with verified information.
4. Review Apple App Privacy and Google Data Safety answers.
5. Confirm the Privacy Policy and Terms effective dates match the release.
6. Add the physical correspondence and store-payment explanation to reviewer
   notes.
7. Add the store-listing transaction disclosure.
8. Enable supported EU countries together unless an objective restriction
   applies.
9. Enable the United Kingdom when the product rollout is approved.
10. Confirm the release displays $3.99 for U.S. destinations and $4.99 for all
    international destinations, matching the amount Stripe charges.
11. Keep the EU/UK order ledger and refund report operational.

## Authoritative references

Accessed October 11, 2026:

- Apple, EU Digital Services Act trader requirements:
  https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/
- Apple, App Review Guidelines:
  https://developer.apple.com/app-store/review/guidelines/
- Google, developer-account verification:
  https://support.google.com/googleplay/android-developer/answer/14177239
- Google, Payments policy:
  https://support.google.com/googleplay/android-developer/answer/9858738
- Google, country and regional distribution requirements:
  https://support.google.com/googleplay/android-developer/answer/6223646
- Google, Data Safety:
  https://support.google.com/googleplay/android-developer/answer/10787469
