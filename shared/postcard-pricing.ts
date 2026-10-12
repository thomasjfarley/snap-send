export const US_POSTCARD_PRICE_CENTS = 399;
export const INTERNATIONAL_POSTCARD_PRICE_CENTS = 499;
export const POSTCARD_PRICING_VERSION = 'destination-only-2026-10';

export function getPostcardPriceCents(destinationCountry?: string | null) {
  return String(destinationCountry ?? 'US').toUpperCase() === 'US'
    ? US_POSTCARD_PRICE_CENTS
    : INTERNATIONAL_POSTCARD_PRICE_CENTS;
}
