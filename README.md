# Snap Send

Send real photo postcards from your phone. Take or upload a photo, apply a frame and filter, write a message, pick a recipient, pay, and a real postcard gets printed and mailed — powered by Lob.com.

## Tech Stack

- **App:** React Native + Expo (managed workflow)
- **Navigation:** Expo Router
- **State:** Zustand
- **Backend:** Supabase (Postgres + Auth)
- **Payments:** Stripe
- **Print & Mail:** Lob.com
- **Address Validation:** Lob.com Verification API
- **Content Moderation:** Google Cloud Vision SafeSearch
- **Image Editing:** @shopify/react-native-skia + react-native-view-shot

## Getting Started

### Prerequisites
- Node.js 18+
- [Expo Go](https://expo.dev/go) on your phone, or an iOS/Android simulator

### Install dependencies
```sh
npm install
```

### Start the dev server
```sh
npm start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

## Project Structure

```
snap-send/
├── app/                    # Expo Router screens
│   ├── (auth)/             # Sign in, sign up, forgot password
│   ├── (onboarding)/       # First-time profile + address setup
│   ├── (tabs)/             # Main tab navigation (Home, Orders, Addresses, Settings)
│   └── postcard/           # Send postcard flow (7-step modal stack)
├── components/             # Reusable UI components
├── constants/              # Theme, editor config, app config
├── lib/                    # Supabase client, Stripe, Lob helpers
├── store/                  # Zustand state stores
├── supabase/
│   ├── functions/          # Edge Functions (validate-address, submit-postcard, etc.)
│   └── migrations/         # SQL migrations
└── assets/
    └── frames/             # Postcard frame PNG overlays
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your keys:

```sh
cp .env.example .env.local
```

## License

Private — All rights reserved.
