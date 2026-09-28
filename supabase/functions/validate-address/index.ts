import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import {
  normalizeCountry,
  POSTGRID_BASE_URL,
  toPostGridContact,
} from '../_shared/postgrid.ts';

const POSTGRID_API_KEY_LIVE = Deno.env.get('POSTGRID_API_KEY')!;
const POSTGRID_API_KEY_TEST = Deno.env.get('POSTGRID_API_KEY_TEST')!;
const LOB_API_KEY_LIVE = Deno.env.get('LOB_API_KEY')!;
const LOB_BASE_URL = 'https://api.lob.com/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function validateUsAddressWithLob(input: {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}) {
  const body: Record<string, string> = {
    primary_line: input.line1,
    city: input.city,
    state: input.state,
    zip_code: input.zip,
  };
  if (input.line2) body.secondary_line = input.line2;

  const credentials = btoa(`${LOB_API_KEY_LIVE}:`);
  const response = await fetch(`${LOB_BASE_URL}/us_verifications`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return null;
  const deliverability = data.deliverability ?? 'undeliverable';
  return {
    verified: deliverability !== 'undeliverable',
    deliverability,
    provider: 'lob',
    address: {
      line1: data.primary_line ?? input.line1,
      line2: data.secondary_line ?? input.line2 ?? null,
      city: data.components?.city ?? input.city,
      state: data.components?.state ?? input.state,
      zip: data.components?.zip_code ?? input.zip,
      country: 'US',
    },
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const {
      full_name = 'Recipient',
      line1,
      line2,
      city,
      state,
      zip,
      country = 'US',
      testMode = false,
    } = await req.json();

    if (!line1 || !city || !state || !zip) {
      return jsonResponse({ error: 'Missing required address fields' }, 400);
    }

    const countryCode = normalizeCountry(country);
    const apiKey = testMode === true ? POSTGRID_API_KEY_TEST : POSTGRID_API_KEY_LIVE;
    if (!apiKey) return jsonResponse({ error: 'Address verification is not configured' }, 503);

    const response = await fetch(`${POSTGRID_BASE_URL}/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(toPostGridContact({
        full_name,
        line1,
        line2,
        city,
        state,
        zip,
        country: countryCode,
      })),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[validate-address] PostGrid error:', response.status, JSON.stringify(data));
      if (testMode !== true && countryCode === 'US') {
        const fallback = await validateUsAddressWithLob({ line1, line2, city, state, zip });
        if (fallback) return jsonResponse(fallback);
      }
      return jsonResponse({ error: 'Address verification failed', detail: data }, 422);
    }

    const deliverability = data.addressStatus ?? 'failed';
    return jsonResponse({
      verified: deliverability === 'verified' || deliverability === 'corrected',
      deliverability,
      provider: 'postgrid',
      address: {
        line1: data.addressLine1 ?? line1,
        line2: data.addressLine2 ?? line2 ?? null,
        city: data.city ?? city,
        state: data.provinceOrState ?? state,
        zip: data.postalOrZip ?? zip,
        country: (data.countryCode ?? countryCode).toUpperCase(),
      },
    });
  } catch (error) {
    console.error('[validate-address] unexpected error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
