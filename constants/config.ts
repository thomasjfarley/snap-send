export const POSTCARD_PRICE_CENTS = 399; // $3.99

// Publishable keys are intentionally public — safe to commit.
// In dev builds (__DEV__) the test key is used automatically so no real charges occur.
const STRIPE_PUBLISHABLE_KEY_LIVE =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
  'pk_live_51TF1SERrIm4fndYKSaLLPoQovPxcXkaoGndehj5cAkniRKK4Dh94MuPOoaarcRxnl3rPVk0cyb0u3UXp706mDmbS00nIcYrhr6';

const STRIPE_PUBLISHABLE_KEY_TEST =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST ||
  'pk_test_51TF1SQRvRfNUzW47MAqxl2MxaQ4GIwPIohXZVNdCRmeQlOUwHKgMSlVuDU9ZGQeqM5ctfin3HiQUJASuanxH10Uk005CVbzONs';

export const STRIPE_PUBLISHABLE_KEY = __DEV__
  ? STRIPE_PUBLISHABLE_KEY_TEST
  : STRIPE_PUBLISHABLE_KEY_LIVE;

export const LOB_POSTCARD_SIZE = '6x4';

export const SUPPORTED_COUNTRIES = ['US'] as const;
