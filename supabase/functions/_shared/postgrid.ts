export const POSTGRID_BASE_URL = 'https://api.postgrid.com/print-mail/v1';

export type SupportedCountry = 'US' | 'CA';

export interface MailingAddress {
  full_name: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  zip: string;
  country?: string | null;
}

export interface PostGridPostcard {
  id: string;
  live: boolean;
  status: 'ready' | 'printing' | 'processed_for_delivery' | 'completed' | 'cancelled';
  url?: string | null;
  sendDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || 'Recipient' };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.at(-1),
  };
}

export function normalizeCountry(country?: string | null): SupportedCountry {
  const normalized = (country || 'US').trim().toUpperCase();
  if (normalized !== 'US' && normalized !== 'CA') {
    throw new Error(`Unsupported destination country: ${normalized}`);
  }
  return normalized;
}

export function toPostGridContact(address: MailingAddress) {
  return {
    ...splitName(address.full_name),
    addressLine1: address.line1,
    ...(address.line2 ? { addressLine2: address.line2 } : {}),
    city: address.city,
    provinceOrState: address.state,
    postalOrZip: address.zip,
    countryCode: normalizeCountry(address.country),
  };
}

export async function createPostGridPostcard(input: {
  apiKey: string;
  idempotencyKey: string;
  sender: MailingAddress;
  recipient: MailingAddress;
  frontHTML: string;
  backHTML: string;
  paymentIntentId: string;
  userId: string;
}): Promise<PostGridPostcard> {
  const response = await fetch(`${POSTGRID_BASE_URL}/postcards`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': input.apiKey,
      'Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({
      to: toPostGridContact(input.recipient),
      from: toPostGridContact(input.sender),
      size: '6x4',
      mailingClass: 'first_class',
      description: 'Snap Send postcard',
      frontHTML: input.frontHTML,
      backHTML: input.backHTML,
      metadata: {
        app: 'snap-send',
        paymentIntentId: input.paymentIntentId,
        userId: input.userId,
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`PostGrid ${response.status}: ${JSON.stringify(data).slice(0, 1000)}`);
    Object.assign(error, { status: response.status, detail: data });
    throw error;
  }
  return data as PostGridPostcard;
}

export async function waitForPostGridPreview(
  apiKey: string,
  postcard: PostGridPostcard,
  attempts = 8,
): Promise<PostGridPostcard> {
  let current = postcard;
  for (let attempt = 0; attempt < attempts && !current.url; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const response = await fetch(`${POSTGRID_BASE_URL}/postcards/${encodeURIComponent(postcard.id)}`, {
      headers: { 'x-api-key': apiKey },
    });
    if (!response.ok) continue;
    current = await response.json() as PostGridPostcard;
  }
  return current;
}

export function mapPostGridStatus(status: string): 'submitted' | 'mailed' | 'delivered' | 'failed' {
  switch (status) {
    case 'processed_for_delivery':
      return 'mailed';
    case 'completed':
      return 'delivered';
    case 'cancelled':
      return 'failed';
    case 'ready':
    case 'printing':
    default:
      return 'submitted';
  }
}
