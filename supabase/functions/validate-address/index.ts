// Edge Function: validate-address
// Calls the Lob Address Verification API and returns a standardized, verified address.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { getAddressRestriction } from '../_shared/market-compliance.ts';

const LOB_API_KEY_LIVE = Deno.env.get('LOB_API_KEY')!;
const LOB_API_KEY_TEST = Deno.env.get('LOB_API_KEY_TEST')!;
const LOB_BASE_URL = 'https://api.lob.com/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      line1, line2, city, state, zip,
      country: rawCountry = 'US',
      testMode = false,
    } = await req.json();
    const LOB_API_KEY = testMode === true ? LOB_API_KEY_TEST : LOB_API_KEY_LIVE;
    const country = String(rawCountry).toUpperCase();

    if (!line1 || !city || !zip || (['US', 'CA'].includes(country) && !state)) {
      return new Response(JSON.stringify({ error: 'Missing required address fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const restriction = getAddressRestriction({ line1, line2, city, state, zip, country });
    if (restriction) {
      return new Response(JSON.stringify({ error: restriction }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // In Lob test mode, simulate a realistic standardized response
    if (LOB_API_KEY.startsWith('test_')) {
      const stdLine1 = line1.toUpperCase().replace(/\bst\b/gi, 'ST').replace(/\bave\b/gi, 'AVE').replace(/\bdr\b/gi, 'DR').replace(/\brd\b/gi, 'RD').replace(/\bblvd\b/gi, 'BLVD').replace(/\bln\b/gi, 'LN').replace(/\bct\b/gi, 'CT');
      const stdCity = city.toUpperCase();
      const stdState = state ? String(state).toUpperCase() : '';
      const stdZip = zip.length === 5 ? `${zip}-1234` : zip; // simulate ZIP+4
      return new Response(
        JSON.stringify({
          verified: true,
          deliverability: 'deliverable',
          coverage: country === 'US' ? null : 'SUBBUILDING',
          status: country === 'US' ? null : 'LV4',
          address: { line1: stdLine1, line2: line2 || null, city: stdCity, state: stdState, zip: stdZip, country },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const credentials = btoa(`${LOB_API_KEY}:`);
    const body: Record<string, string> = {
      primary_line: line1,
      city,
    };
    if (state) body.state = state;
    if (country === 'US') {
      body.zip_code = zip;
    } else {
      body.postal_code = zip;
      body.country = country;
    }
    if (line2) body.secondary_line = line2;

    const endpoint = country === 'US' ? 'us_verifications' : 'intl_verifications';
    const lobRes = await fetch(`${LOB_BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const lobData = await lobRes.json();

    if (!lobRes.ok) {
      console.error('Lob error:', lobRes.status, JSON.stringify(lobData));
      return new Response(JSON.stringify({ error: 'Address verification failed', detail: lobData }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const blockedDeliverability = new Set(['undeliverable', 'no_match']);
    const verified =
      lobData.deliverability != null &&
      !blockedDeliverability.has(lobData.deliverability);

    return new Response(
      JSON.stringify({
        verified,
        deliverability: lobData.deliverability,
        coverage: lobData.coverage ?? null,
        status: lobData.status ?? null,
        address: {
          line1: lobData.primary_line,
          line2: lobData.secondary_line || null,
          city: lobData.components?.city,
          state: lobData.components?.state,
          zip: lobData.components?.zip_code ?? lobData.components?.postal_code,
          country,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error', detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
