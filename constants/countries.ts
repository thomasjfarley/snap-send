import countries from 'world-countries';

export type CountryRiskTier = 'standard' | 'limited';

export interface MailingCountry {
  code: string;
  name: string;
  flag: string;
  riskTier: CountryRiskTier;
}

const LOB_INTERNATIONAL_AV_CODES = new Set(`
AD AE AF AG AI AL AO AR AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BQ BR BS BT BW BY BZ
CA CD CG CH CI CK CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK
FO FR GA GB GD GE GH GI GL GM GN GQ GR GS GT GW GY HK HN HR HT HU ID IE IL IN IO IQ IR IS IT JM
JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MK ML MM
MN MO MR MS MT MU MV MW MX MY MZ NA NE NF NG NI NL NO NP NR NU NZ OM PA PE PG PH PK PL PN PT PY
QA RO RS RU RW SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL
TM TN TO TR TT TV TW TZ UA UG UY UZ VA VC VE VG VN VU WS YE ZA ZM ZW
`.trim().split(/\s+/));

// USPS First-Class Mail International suspensions as of 2026-09-25.
const SUSPENDED_CODES = new Set([
  'AF', 'BY', 'BT', 'CU', 'ER', 'HT', 'IR', 'KI', 'CG', 'SC', 'SS', 'SD', 'TM', 'YE',
]);

// Markets with comparatively strong Lob verification data and established
// postal systems. All remaining enabled destinations are still available but
// receive a limited-verification warning before purchase.
const STANDARD_MARKET_CODES = new Set([
  'AT', 'AU', 'BE', 'BR', 'CA', 'CH', 'CL', 'DE', 'DK', 'ES', 'FI', 'FR', 'GB',
  'IE', 'IT', 'JP', 'KR', 'MX', 'NL', 'NO', 'NZ', 'PT', 'SE', 'SG', 'TH', 'TW',
]);

const internationalCountries: MailingCountry[] = countries
  .filter((country) =>
    LOB_INTERNATIONAL_AV_CODES.has(country.cca2) &&
    !SUSPENDED_CODES.has(country.cca2),
  )
  .map((country) => ({
    code: country.cca2,
    name: country.name.common,
    flag: country.flag,
    riskTier: STANDARD_MARKET_CODES.has(country.cca2) ? 'standard' : 'limited',
  }));

const canada = internationalCountries.find((country) => country.code === 'CA');
const standard = internationalCountries
  .filter((country) => country.code !== 'CA' && country.riskTier === 'standard')
  .sort((a, b) => a.name.localeCompare(b.name));
const limited = internationalCountries
  .filter((country) => country.riskTier === 'limited')
  .sort((a, b) => a.name.localeCompare(b.name));

export const MAILING_COUNTRIES: MailingCountry[] = [
  { code: 'US', name: 'United States', flag: '🇺🇸', riskTier: 'standard' },
  ...(canada ? [canada] : []),
  ...standard,
  ...limited,
];

export const MAILING_COUNTRY_BY_CODE = new Map(
  MAILING_COUNTRIES.map((country) => [country.code, country]),
);

export function getMailingCountry(code?: string | null) {
  return MAILING_COUNTRY_BY_CODE.get((code || 'US').toUpperCase()) ??
    MAILING_COUNTRY_BY_CODE.get('US')!;
}

export function requiresInternationalRiskWarning(code?: string | null) {
  const country = getMailingCountry(code);
  return country.code !== 'US' && country.riskTier === 'limited';
}

