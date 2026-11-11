export const US_POSTCARD_PRICE_CENTS = 399;
export const INTERNATIONAL_POSTCARD_PRICE_CENTS = 499;
// Lob Developer plan (per Lob dashboard, Nov 2026): $0.909 per 4x6 First Class piece, rounded up
// to a whole cent; international adds a $1.429 fee ($2.338 total, rounded up). Used for accounts in at_cost_accounts.
export const AT_COST_US_POSTCARD_PRICE_CENTS = 91;
export const AT_COST_INTERNATIONAL_POSTCARD_PRICE_CENTS = 234;
export const POSTCARD_PRICING_VERSION = 'destination-only-2026-10';

export function getPostcardPriceCents(destinationCountry?: string | null, atCost = false) {
  const isUs = String(destinationCountry ?? 'US').toUpperCase() === 'US';
  if (atCost) {
    return isUs ? AT_COST_US_POSTCARD_PRICE_CENTS : AT_COST_INTERNATIONAL_POSTCARD_PRICE_CENTS;
  }
  return isUs ? US_POSTCARD_PRICE_CENTS : INTERNATIONAL_POSTCARD_PRICE_CENTS;
}
