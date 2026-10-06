const RESTRICTED_COUNTRY_CODES = new Set([
  'BY',
  'CU',
  'IR',
  'KP',
  'RU',
  'SY',
]);

const RESTRICTED_UKRAINE_REGION_PATTERN =
  /\b(crimea|krym|sevastopol|donetsk|luhansk|lugansk)\b|крым|севастопол|донецк|луганск/i;

export interface ComplianceAddress {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
}

export function getAddressRestriction(address: ComplianceAddress): string | null {
  const country = String(address.country || 'US').toUpperCase();
  if (RESTRICTED_COUNTRY_CODES.has(country)) {
    return 'Snap Send is not available in this country.';
  }

  if (country === 'UA') {
    const searchable = [
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.zip,
    ].filter(Boolean).join(' ');
    if (RESTRICTED_UKRAINE_REGION_PATTERN.test(searchable)) {
      return 'Snap Send is not available in this region.';
    }
  }

  return null;
}
