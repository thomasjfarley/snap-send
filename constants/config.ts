export const POSTCARD_PRICE_CENTS = 399; // $3.99

// Publishable keys are intentionally public — safe to commit.
// The env var overrides this in dev (e.g. pk_test_ for local testing).
export const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
  'pk_live_51TF1SERrIm4fndYKSaLLPoQovPxcXkaoGndehj5cAkniRKK4Dh94MuPOoaarcRxnl3rPVk0cyb0u3UXp706mDmbS00nIcYrhr6';

export const LOB_POSTCARD_SIZE = '6x4';

export const SUPPORTED_COUNTRIES = ['US'] as const;
