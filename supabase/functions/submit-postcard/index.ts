// Edge Function: submit-postcard
// Full pipeline:
//   1. Verify auth + payment succeeded
//   2. Google Cloud Vision SafeSearch — reject illicit images (LEGAL REQUIREMENT)
//   3. Call Lob.com to print and mail the postcard
//   4. Record postcard + order in DB
//   5. Image is never persisted server-side

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const LOB_API_KEY = Deno.env.get('LOB_API_KEY')!;
const GOOGLE_VISION_API_KEY = Deno.env.get('GOOGLE_VISION_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const LOB_BASE_URL = 'https://api.lob.com/v1';
const VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;

// Likelihood levels ordered by severity
const LIKELIHOOD_LEVELS = ['UNKNOWN', 'VERY_UNLIKELY', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'VERY_LIKELY'];
const BLOCK_THRESHOLD = 'LIKELY'; // block at LIKELY or VERY_LIKELY

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isBlocked(likelihood: string): boolean {
  return LIKELIHOOD_LEVELS.indexOf(likelihood) >= LIKELIHOOD_LEVELS.indexOf(BLOCK_THRESHOLD);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      imageBase64,      // base64-encoded JPEG of the composed postcard front
      message,          // text for the back of the postcard
      frame,
      filter,
      fromAddressId,    // UUID from addresses table
      toAddressId,      // UUID from addresses table
      recipientSnapshot,// { full_name, line1, line2, city, state, zip }
      paymentIntentId,
    } = await req.json();

    if (!imageBase64 || !paymentIntentId || !fromAddressId || !toAddressId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Verify Stripe payment succeeded ────────────────────────────────────
    const piRes = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const pi = await piRes.json();

    if (!piRes.ok || pi.status !== 'succeeded' || pi.metadata?.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Payment not confirmed' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Google Cloud Vision SafeSearch ────────────────────────────────────
    // LEGAL REQUIREMENT: USPS prohibits mailing obscene material (18 U.S.C. § 1461)
    const visionRes = await fetch(VISION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: imageBase64 },
          features: [{ type: 'SAFE_SEARCH_DETECTION' }],
        }],
      }),
    });

    const visionData = await visionRes.json();
    const safeSearch = visionData.responses?.[0]?.safeSearchAnnotation;

    if (!safeSearch) {
      return new Response(JSON.stringify({ error: 'Content moderation unavailable. Please try again.' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (isBlocked(safeSearch.adult) || isBlocked(safeSearch.violence)) {
      return new Response(
        JSON.stringify({
          error: 'This image cannot be sent. Please choose a different photo.',
          code: 'CONTENT_REJECTED',
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 4. Fetch from/to address details from DB ──────────────────────────────
    const { data: fromAddress, error: fromErr } = await supabase
      .from('addresses')
      .select('*')
      .eq('id', fromAddressId)
      .eq('user_id', user.id)
      .single();

    if (fromErr || !fromAddress) {
      return new Response(JSON.stringify({ error: 'Sender address not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 5. Send postcard via Lob ──────────────────────────────────────────────
    const lobCredentials = btoa(`${LOB_API_KEY}:`);

    const lobBody: Record<string, unknown> = {
      description: 'Snap Send postcard',
      size: '6x4',
      front: `data:image/jpeg;base64,${imageBase64}`,
      // Standard postcard back template with message and address
      back: `<html><body style="font-family:sans-serif;padding:20px"><p style="font-size:14px">${message.replace(/</g, '&lt;')}</p></body></html>`,
      to: {
        name: recipientSnapshot.full_name,
        address_line1: recipientSnapshot.line1,
        address_line2: recipientSnapshot.line2 || undefined,
        address_city: recipientSnapshot.city,
        address_state: recipientSnapshot.state,
        address_zip: recipientSnapshot.zip,
        address_country: 'US',
      },
      from: {
        name: fromAddress.full_name,
        address_line1: fromAddress.line1,
        address_line2: fromAddress.line2 || undefined,
        address_city: fromAddress.city,
        address_state: fromAddress.state,
        address_zip: fromAddress.zip,
        address_country: 'US',
      },
    };

    const lobRes = await fetch(`${LOB_BASE_URL}/postcards`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${lobCredentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(lobBody),
    });

    const lobData = await lobRes.json();

    if (!lobRes.ok) {
      return new Response(JSON.stringify({ error: 'Failed to create postcard', detail: lobData }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 6. Record in database (image NOT stored) ──────────────────────────────
    const { data: postcard, error: insertErr } = await supabase
      .from('postcards')
      .insert({
        user_id: user.id,
        message,
        frame: frame ?? 'none',
        filter: filter ?? 'none',
        from_address_id: fromAddressId,
        to_address_id: toAddressId,
        recipient_snapshot: recipientSnapshot,
        status: 'submitted',
        lob_id: lobData.id,
        stripe_payment_intent_id: paymentIntentId,
        price_cents: pi.amount,
      })
      .select()
      .single();

    if (insertErr || !postcard) {
      // Postcard was mailed but DB write failed — log and return partial success
      console.error('DB insert failed after successful Lob send:', insertErr);
      return new Response(
        JSON.stringify({ success: true, lobId: lobData.id, postcardId: null, warning: 'DB record failed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    await supabase.from('orders').insert({
      user_id: user.id,
      postcard_id: postcard.id,
      stripe_payment_intent_id: paymentIntentId,
      amount_cents: pi.amount,
      status: 'succeeded',
    });

    return new Response(
      JSON.stringify({ success: true, postcardId: postcard.id, lobId: lobData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error', detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
