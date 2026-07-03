// Edge Function: create-payment-intent
// Creates a Stripe PaymentIntent for a single postcard send.
// Uses Stripe Tax Calculation API to compute tax based on customer billing address.
// Called by the client just before showing the Stripe PaymentSheet.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY_LIVE = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_SECRET_KEY_TEST = Deno.env.get('STRIPE_SECRET_KEY_TEST')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function reportError(source: string, title: string, severity: 'warning' | 'error' | 'critical', details: string, userEmail = '') {
  fetch(`${SUPABASE_URL}/functions/v1/report-error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ source, title, severity, details, userEmail }),
  }).catch(() => {});
}

const POSTCARD_PRICE_CENTS = 399;
// General - Tangible Personal Property (provisional; confirm with tax advisor)
const POSTCARD_TAX_CODE = 'txcd_99999999';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  let reportUserId = '';
  let reportUserEmail = '';

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify the user is authenticated
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

    reportUserId = user.id;
    reportUserEmail = user.email ?? '';

    const body = await req.json().catch(() => ({}));
    const testMode = body?.testMode === true;
    const STRIPE_SECRET_KEY = testMode ? STRIPE_SECRET_KEY_TEST : STRIPE_SECRET_KEY_LIVE;
    const addr = body?.customerAddress;

    // Address is required — customers cannot check out without one
    if (!addr?.line1 || !addr?.city || !addr?.state || !addr?.postalCode) {
      return new Response(
        JSON.stringify({ error: 'Customer billing address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const stripeHeaders = {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Stripe-Version': '2023-10-16',
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    // Step 1: Calculate tax via Stripe Tax Calculation API
    const taxParams = new URLSearchParams({
      currency: 'usd',
      'line_items[0][amount]': String(POSTCARD_PRICE_CENTS),
      'line_items[0][reference]': 'postcard',
      'line_items[0][tax_code]': POSTCARD_TAX_CODE,
      'customer_details[address][line1]': addr.line1,
      'customer_details[address][city]': addr.city,
      'customer_details[address][state]': addr.state,
      'customer_details[address][postal_code]': addr.postalCode,
      'customer_details[address][country]': addr.country ?? 'US',
      'customer_details[address_source]': 'billing',
    });
    if (addr.line2) taxParams.set('customer_details[address][line2]', addr.line2);

    const taxRes = await fetch('https://api.stripe.com/v1/tax/calculations', {
      method: 'POST',
      headers: stripeHeaders,
      body: taxParams,
    });
    const taxData = await taxRes.json();

    let chargeAmountCents = POSTCARD_PRICE_CENTS;
    let taxAmountCents = 0;
    let taxCalculationId: string | null = null;

    if (taxRes.ok && taxData.id) {
      chargeAmountCents = taxData.amount_total;
      taxAmountCents = taxData.tax_amount_exclusive ?? 0;
      taxCalculationId = taxData.id;
    } else {
      // For non-transient errors (bad address, invalid params), fail hard
      if (taxRes.status < 500) {
        console.error('[create-payment-intent] Tax calculation error:', JSON.stringify(taxData));
        return new Response(
          JSON.stringify({ error: 'Tax calculation failed', detail: taxData }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      // Transient Stripe outage — proceed without tax
      console.error('[create-payment-intent] Transient tax calc failure, proceeding without tax:', JSON.stringify(taxData));
    }

    // Step 2: Create PaymentIntent with the tax-inclusive amount.
    // Restrict to card only — this surfaces Apple Pay and Google Pay as wallet
    // shortcuts within the card flow, without showing every method in the dashboard.
    const piParams = new URLSearchParams({
      amount: String(chargeAmountCents),
      currency: 'usd',
      'payment_method_types[0]': 'card',
      'metadata[user_id]': user.id,
    });
    if (taxCalculationId) piParams.set('metadata[tax_calculation]', taxCalculationId);

    const piRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: stripeHeaders,
      body: piParams,
    });
    const paymentIntent = await piRes.json();

    if (!piRes.ok) {
      console.error('[create-payment-intent] Stripe PaymentIntent error:', JSON.stringify(paymentIntent));
      reportError(
        'create-payment-intent',
        'Stripe PaymentIntent creation failed',
        'error',
        `userId=${reportUserId}; status=${piRes.status}; response=${JSON.stringify(paymentIntent).slice(0, 1000)}`,
        reportUserEmail,
      );
      return new Response(JSON.stringify({ error: 'Stripe error', detail: paymentIntent }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: chargeAmountCents,
        taxAmountCents,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    reportError(
      'create-payment-intent',
      'Unhandled create-payment-intent error',
      'critical',
      `userId=${reportUserId || 'unknown'}; error=${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`,
      reportUserEmail,
    );
    return new Response(JSON.stringify({ error: 'Internal server error', detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
