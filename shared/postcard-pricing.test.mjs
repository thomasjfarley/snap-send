import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EU_UK_HIGH_PRICE_CENTS,
  EU_UK_STANDARD_PRICE_CENTS,
  getLegacyPostcardPriceCents,
  getPostcardPriceCents,
  INTERNATIONAL_POSTCARD_PRICE_CENTS,
  US_POSTCARD_PRICE_CENTS,
} from './postcard-pricing.ts';

test('keeps existing prices when either side is outside the EU and UK', () => {
  assert.equal(getPostcardPriceCents('US', 'US'), US_POSTCARD_PRICE_CENTS);
  assert.equal(getPostcardPriceCents('FR', 'US'), US_POSTCARD_PRICE_CENTS);
  assert.equal(getPostcardPriceCents('US', 'FR'), INTERNATIONAL_POSTCARD_PRICE_CENTS);
  assert.equal(getPostcardPriceCents('FR', 'CA'), INTERNATIONAL_POSTCARD_PRICE_CENTS);
  assert.equal(getPostcardPriceCents('CA', 'FR'), INTERNATIONAL_POSTCARD_PRICE_CENTS);
  assert.equal(getPostcardPriceCents('CA', 'JP'), INTERNATIONAL_POSTCARD_PRICE_CENTS);
});

test('keeps legacy clients on destination-only pricing', () => {
  assert.equal(getLegacyPostcardPriceCents('US'), US_POSTCARD_PRICE_CENTS);
  assert.equal(getLegacyPostcardPriceCents('FR'), INTERNATIONAL_POSTCARD_PRICE_CENTS);
});

test('uses the destination tier when both sides are in the EU or UK', () => {
  const standardCountries = ['AT', 'BG', 'CY', 'FR', 'DE', 'LU', 'MT', 'GB'];
  const highCountries = [
    'BE', 'HR', 'CZ', 'DK', 'EE', 'FI', 'GR', 'HU', 'IE', 'IT',
    'LV', 'LT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  ];

  for (const country of standardCountries) {
    assert.equal(getPostcardPriceCents('FR', country), EU_UK_STANDARD_PRICE_CENTS);
  }
  for (const country of highCountries) {
    assert.equal(getPostcardPriceCents('FR', country), EU_UK_HIGH_PRICE_CENTS);
  }
});
