// Edge Function: request-refund
// Called by the client when the user cancels after a post-payment submission failure.
// Issues a Stripe refund and delegates notification to the report-error function.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY_LIVE    = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_SECRET_KEY_TEST    = Deno.env.get('STRIPE_SECRET_KEY_TEST')!;
const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

// Fire-and-forget call to the centralised report-error function.
function reportError(opts: { title: string; severity: string; details: string; userEmail: string }) {
  fetch(`${SUPABASE_URL}/functions/v1/report-error`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ source: 'request-refund', ...opts }),
  }).catch(err => console.error('[request-refund] reportError call failed:', err));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return jsonResponse({ error: 'Unauthorized' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { paymentIntentId, testMode, errorLog = [] } = await req.json();
    if (!paymentIntentId) return jsonResponse({ error: 'Missing paymentIntentId' }, 400);

    const STRIPE_SECRET_KEY = testMode === true ? STRIPE_SECRET_KEY_TEST : STRIPE_SECRET_KEY_LIVE;

    // Verify the PaymentIntent belongs to this user before refunding
    const piRes = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const pi = await piRes.json();
    if (!piRes.ok || pi.metadata?.user_id !== user.id) {
      return jsonResponse({ error: 'Payment not found or unauthorized' }, 403);
    }

    // Issue the refund
    const refundRes = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ payment_intent: paymentIntentId, reason: 'requested_by_customer' }),
    });
    const refundData = await refundRes.json();

    const details = [
      `Payment Intent: ${paymentIntentId}`,
      `Stripe Dashboard: https://dashboard.stripe.com/payments/${paymentIntentId}`,
      `Submission errors:`,
      ...(errorLog.length > 0 ? errorLog.map((e: string, i: number) => `  ${i + 1}. ${e}`) : ['  (none provided)']),
      !refundRes.ok ? `\nStripe error: ${JSON.stringify(refundData)}` : `\nRefund ID: ${refundData.id}`,
    ].join('\n');

    if (!refundRes.ok) {
      console.error('[request-refund] Stripe refund failed:', JSON.stringify(refundData));
      reportError({ title: 'Stripe refund FAILED — manual action required', severity: 'critical', details, userEmail: user.email ?? 'unknown' });
      return jsonResponse({ error: 'Refund could not be processed automatically. Support has been notified.' }, 500);
    }

    console.log('[request-refund] refund issued:', refundData.id, 'for PI', paymentIntentId);
    reportError({ title: 'User refunded after submission failure', severity: 'warning', details, userEmail: user.email ?? 'unknown' });

    return jsonResponse({ success: true, refundId: refundData.id });
  } catch (err) {
    console.error('[request-refund] unhandled error:', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
