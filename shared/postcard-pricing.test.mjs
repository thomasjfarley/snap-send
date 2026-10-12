import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPostcardPriceCents,
  INTERNATIONAL_POSTCARD_PRICE_CENTS,
  US_POSTCARD_PRICE_CENTS,
} from './postcard-pricing.ts';

test('charges the domestic price for US destinations', () => {
  assert.equal(getPostcardPriceCents('US'), US_POSTCARD_PRICE_CENTS);
  assert.equal(getPostcardPriceCents('us'), US_POSTCARD_PRICE_CENTS);
});

test('charges the same international price for every non-US destination', () => {
  const internationalCountries = [
    'AT', 'BG', 'CY', 'FR', 'DE', 'LU', 'MT', 'GB',
    'BE', 'HR', 'CZ', 'DK', 'EE', 'FI', 'GR', 'HU', 'IE', 'IT',
    'LV', 'LT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
    'CA', 'JP', 'AU', 'BR', 'ZA',
  ];

  for (const country of internationalCountries) {
    assert.equal(getPostcardPriceCents(country), INTERNATIONAL_POSTCARD_PRICE_CENTS);
  }
});
