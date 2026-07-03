// Edge Function: request-refund
// Called by the client when the user cancels after a post-payment submission failure.
// Issues a Stripe refund and notifies support@snapsend.live via Resend.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY_LIVE = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_SECRET_KEY_TEST = Deno.env.get('STRIPE_SECRET_KEY_TEST')!;
const RESEND_API_KEY          = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL            = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const SUPPORT_EMAIL  = 'support@snapsend.live';
const ALERT_FROM     = 'Snap Send Alerts <alerts@snapsend.live>';

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

async function sendSupportEmail(opts: {
  userEmail: string;
  paymentIntentId: string;
  errorLog: string[];
  refunded: boolean;
  refundId?: string;
}) {
  const { userEmail, paymentIntentId, errorLog, refunded, refundId } = opts;
  const subject = refunded
    ? `⚠️ Snap Send: User refunded after submission failure`
    : `🚨 Snap Send: Refund FAILED — manual action required`;

  const lines = [
    `A user could not submit a postcard after payment was confirmed.`,
    refunded
      ? `✅ Refund issued automatically (${refundId}).`
      : `❌ Automatic refund FAILED — please refund manually in Stripe.`,
    ``,
    `User:           ${userEmail}`,
    `Payment Intent: ${paymentIntentId}`,
    `Time:           ${new Date().toISOString()}`,
    ``,
    `Stripe Dashboard:`,
    `  https://dashboard.stripe.com/payments/${paymentIntentId}`,
    ``,
    `Errors reported during submission attempts:`,
    ...(errorLog.length > 0
      ? errorLog.map((e, i) => `  ${i + 1}. ${e}`)
      : [`  (none provided)`]),
  ];

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: ALERT_FROM,
        to: [SUPPORT_EMAIL],
        subject,
        text: lines.join('\n'),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('[request-refund] Resend error:', JSON.stringify(body));
    }
  } catch (err) {
    // Non-fatal — refund already succeeded; just log
    console.error('[request-refund] email send threw:', err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Authenticate
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
      body: new URLSearchParams({
        payment_intent: paymentIntentId,
        reason: 'requested_by_customer',
      }),
    });
    const refundData = await refundRes.json();

    if (!refundRes.ok) {
      console.error('[request-refund] Stripe refund failed:', JSON.stringify(refundData));
      await sendSupportEmail({
        userEmail: user.email ?? 'unknown',
        paymentIntentId,
        errorLog,
        refunded: false,
      });
      return jsonResponse(
        { error: 'Refund could not be processed automatically. Support has been notified.' },
        500,
      );
    }

    console.log('[request-refund] refund issued:', refundData.id, 'for PI', paymentIntentId);

    // Notify support (non-blocking — don't let email failure affect the response)
    sendSupportEmail({
      userEmail: user.email ?? 'unknown',
      paymentIntentId,
      errorLog,
      refunded: true,
      refundId: refundData.id,
    });

    return jsonResponse({ success: true, refundId: refundData.id });
  } catch (err) {
    console.error('[request-refund] unhandled error:', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
