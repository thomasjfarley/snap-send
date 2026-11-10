import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

type Params = Record<string, unknown>;

let creationId: string | undefined;
let checkoutLoggedFor: string | undefined;
let completedLoggedFor: string | undefined;

export function getCreationId() {
  return creationId;
}

export async function getAppInstanceId(): Promise<string | null> {
  try {
    const a = getAnalytics();
    return a ? ((await a.getAppInstanceId()) ?? null) : null;
  } catch {
    return null;
  }
}

// Firebase is native-only and unavailable in Expo Go; every call is a safe no-op there.
function getAnalytics(): any | null {
  if (Platform.OS === 'web') return null;
  try {
    return require('@react-native-firebase/analytics').getAnalytics();
  } catch {
    return null;
  }
}

function run(fn: (a: any) => Promise<unknown> | void) {
  try {
    const a = getAnalytics();
    if (!a) return;
    Promise.resolve(fn(a)).catch(() => {});
  } catch {
    // Analytics must never break the app
  }
}

export function logEvent(name: string, params?: Params) {
  run((a) => a.logEvent(name, params));
}

export function logScreenView(screenName: string) {
  run((a) => a.logScreenView({ screen_name: screenName, screen_class: screenName }));
}

export function setAnalyticsUserId(id: string | null) {
  run((a) => a.setUserId(id));
}

export function setAnalyticsEnabled(enabled: boolean) {
  run(async (a) => {
    await a.setAnalyticsCollectionEnabled(enabled);
    if (!enabled) await a.resetAnalyticsData();
  });
}

export const analytics = {
  signUp: (method: string) => logEvent('sign_up', { method }),

  // One ID per postcard, so started/completed/checkout/purchase/sent can be joined
  postcardStarted: () => {
    creationId = Crypto.randomUUID();
    logEvent('postcard_started', { creation_id: creationId });
  },
  // Fires once per postcard, only when photo, message and a valid recipient exist
  postcardCompleted: (ready: boolean) => {
    if (!ready || !creationId || completedLoggedFor === creationId) return;
    completedLoggedFor = creationId;
    logEvent('postcard_completed', { creation_id: creationId });
  },
  // Fires when the checkout screen opens; value is the item price (tax not yet known, excluded per GA4)
  beginCheckout: (valueCents: number, destinationCountry: string, quantity = 1, currency = 'USD') => {
    if (checkoutLoggedFor === creationId) return;
    checkoutLoggedFor = creationId;
    const value = valueCents / 100;
    logEvent('begin_checkout', {
      value,
      currency,
      quantity,
      destination_type: destinationCountry.toUpperCase() === 'US' ? 'domestic' : 'international',
      creation_id: creationId,
      items: [{ item_id: 'postcard', item_name: 'Postcard', price: value / quantity, quantity }],
    });
  },
  postcardSent: () => logEvent('postcard_sent', { creation_id: creationId }),
};
