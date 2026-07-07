// Edge Function: stripe-webhook
// Handles Stripe payment events to keep order status in sync.
// Register this URL in your Stripe dashboard: Developers → Webhooks

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const STRIPE_WEBHOOK_SECRET_TEST = Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST') ?? '';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function reportError(source: string, title: string, severity: 'warning' | 'error' | 'critical', details: string, userEmail = '') {
  fetch(`${SUPABASE_URL}/functions/v1/report-error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ source, title, severity, details, userEmail }),
  }).catch(() => {});
}

async function verifyStripeSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const parts = signature.split(',').reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.split('=');
    acc[k] = v;
    return acc;
  }, {});

  const timestamp = parts['t'];
  const expectedSig = parts['v1'];
  if (!timestamp || !expectedSig) return false;

  const payload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const computedSig = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return computedSig === expectedSig;
}

serve(async (req) => {
  let reportEventType = '';
  let reportPaymentIntentId = '';

  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature') ?? '';

    // Try live secret first, fall back to test secret for dev/sandbox events
    let valid = await verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET);
    if (!valid && STRIPE_WEBHOOK_SECRET_TEST) {
      valid = await verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET_TEST);
    }
    if (!valid) {
      return new Response('Invalid signature', { status: 400 });
    }

    const event = JSON.parse(body);
    reportEventType = event.type ?? '';
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
      if (event.type === 'payment_intent.payment_failed') {
        const paymentIntentId: string = event.data.object.id;
        reportPaymentIntentId = paymentIntentId;
        const { error: ordersError } = await supabase
          .from('orders')
          .update({ status: 'failed' })
          .eq('stripe_payment_intent_id', paymentIntentId);
        if (ordersError) {
          reportError(
            'stripe-webhook',
            'Failed to update failed order status',
            'error',
            `eventType=${event.type}; paymentIntentId=${paymentIntentId}; table=orders; error=${ordersError.message}`,
          );
        }

        const { error: postcardsError } = await supabase
          .from('postcards')
          .update({ status: 'failed' })
          .eq('stripe_payment_intent_id', paymentIntentId);
        if (postcardsError) {
          reportError(
            'stripe-webhook',
            'Failed to update failed postcard status',
            'error',
            `eventType=${event.type}; paymentIntentId=${paymentIntentId}; table=postcards; error=${postcardsError.message}`,
          );
        }
      }
    } catch (processingError) {
      reportError(
        'stripe-webhook',
        'Unexpected Stripe webhook processing error',
        'error',
        `eventType=${event.type ?? 'unknown'}; error=${processingError instanceof Error ? `${processingError.name}: ${processingError.message}` : String(processingError)}`,
      );
      throw processingError;
    }

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('Stripe webhook error:', err);
    reportError(
      'stripe-webhook',
      'Unhandled stripe webhook error',
      'critical',
      `eventType=${reportEventType || 'unknown'}; paymentIntentId=${reportPaymentIntentId || 'unknown'}; error=${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`,
    );
    return new Response('Internal server error', { status: 500 });
  }
});
