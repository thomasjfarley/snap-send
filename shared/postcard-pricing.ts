export const US_POSTCARD_PRICE_CENTS = 399;
export const INTERNATIONAL_POSTCARD_PRICE_CENTS = 499;
export const EU_UK_STANDARD_PRICE_CENTS = 599;
export const EU_UK_HIGH_PRICE_CENTS = 649;
export const POSTCARD_PRICING_VERSION = 'eu-uk-2026-10';

const EU_UK_STANDARD_COUNTRIES = new Set([
  'AT',
  'BG',
  'CY',
  'FR',
  'DE',
  'LU',
  'MT',
  'GB',
]);

const EU_UK_HIGH_COUNTRIES = new Set([
  'BE',
  'HR',
  'CZ',
  'DK',
  'EE',
  'FI',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
]);

export function isEuUkCountry(country?: string | null) {
  const countryCode = String(country ?? '').toUpperCase();
  return EU_UK_STANDARD_COUNTRIES.has(countryCode) || EU_UK_HIGH_COUNTRIES.has(countryCode);
}

export function getLegacyPostcardPriceCents(destinationCountry?: string | null) {
  return String(destinationCountry ?? 'US').toUpperCase() === 'US'
    ? US_POSTCARD_PRICE_CENTS
    : INTERNATIONAL_POSTCARD_PRICE_CENTS;
}

export function getPostcardPriceCents(
  billingCountry?: string | null,
  destinationCountry?: string | null,
) {
  const billingCountryCode = String(billingCountry ?? 'US').toUpperCase();
  const destinationCountryCode = String(destinationCountry ?? 'US').toUpperCase();

  if (!isEuUkCountry(billingCountryCode) || !isEuUkCountry(destinationCountryCode)) {
    return getLegacyPostcardPriceCents(destinationCountryCode);
  }

  return EU_UK_STANDARD_COUNTRIES.has(destinationCountryCode)
    ? EU_UK_STANDARD_PRICE_CENTS
    : EU_UK_HIGH_PRICE_CENTS;
}
