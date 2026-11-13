import type { Address } from '@/lib/database.types';

// Alphabetical by name (first name first), optionally filtered by a search query
// matched against the name, label and every address field.
export function sortAndFilterAddresses(addresses: Address[], query: string): Address[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (a: Address) => {
    if (terms.length === 0) return true;
    const haystack = [a.full_name, a.label, a.line1, a.line2, a.city, a.state, a.zip]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return terms.every((t) => haystack.includes(t));
  };
  return addresses
    .filter(matches)
    .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', undefined, { sensitivity: 'base' }));
}
