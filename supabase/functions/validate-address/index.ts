// Edge Function: validate-address
// Calls the Lob Address Verification API and returns a standardized, verified address.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const LOB_API_KEY = Deno.env.get('LOB_API_KEY')!;
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
    const { line1, line2, city, state, zip, country = 'US' } = await req.json();

    if (!line1 || !city || !state || !zip) {
      return new Response(JSON.stringify({ error: 'Missing required address fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const credentials = btoa(`${LOB_API_KEY}:`);
    const body: Record<string, string> = {
      primary_line: line1,
      city,
      state,
      zip_code: zip,
    };
    if (line2) body.secondary_line = line2;

    const lobRes = await fetch(`${LOB_BASE_URL}/us_verifications`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const lobData = await lobRes.json();

    if (!lobRes.ok) {
      return new Response(JSON.stringify({ error: 'Address verification failed', detail: lobData }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // deliverability values: deliverable, deliverable_unnecessary_unit,
    // deliverable_incorrect_unit, deliverable_missing_unit, undeliverable
    const verified = lobData.deliverability === 'deliverable';

    return new Response(
      JSON.stringify({
        verified,
        deliverability: lobData.deliverability,
        address: {
          line1: lobData.primary_line,
          line2: lobData.secondary_line || null,
          city: lobData.components?.city,
          state: lobData.components?.state,
          zip: lobData.components?.zip_code,
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
