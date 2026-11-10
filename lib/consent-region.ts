import { Platform } from 'react-native';
import { getLocales, getCalendars } from 'expo-localization';

// EU, EEA, UK and Switzerland
const CONSENT_REGIONS = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', 'GB', 'CH',
]);

// Opt-in consent is required for analytics in these regions. Device region is
// the primary signal; a European time zone also counts, and an unknown region
// is treated as requiring consent.
export function requiresAnalyticsConsent(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    const region = getLocales()[0]?.regionCode;
    const timeZone = getCalendars()[0]?.timeZone ?? '';
    if (!region) return true;
    return CONSENT_REGIONS.has(region.toUpperCase()) || timeZone.startsWith('Europe/');
  } catch {
    return true;
  }
}
