// Edge Function: stripe-webhook
// Handles Stripe payment events to keep order status in sync.
// Register this URL in your Stripe dashboard: Developers → Webhooks

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { recordTaxTransaction, reverseTaxTransaction } from '../_shared/stripe-tax.ts';

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const STRIPE_WEBHOOK_SECRET_TEST = Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST') ?? '';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_SECRET_KEY_TEST = Deno.env.get('STRIPE_SECRET_KEY_TEST') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EU_UK_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE',
  'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT',
  'RO', 'SK', 'SI', 'ES', 'SE', 'GB',
]);

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

function stripeDate(timestamp: unknown) {
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error(`Invalid Stripe timestamp: ${String(timestamp)}`);
  }
  return new Date(seconds * 1000);
}

function metadataAmount(value: unknown, label: string) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error(`Invalid ${label}: ${String(value)}`);
  }
  return amount;
}

async function recordEuUkOrder(
  supabase: ReturnType<typeof createClient>,
  paymentIntent: any,
  stripeTaxTransactionId: string | undefined,
  paidTimestamp: unknown,
) {
  const billingCountry = String(paymentIntent.metadata?.billing_country ?? '').toUpperCase();
  if (!EU_UK_COUNTRIES.has(billingCountry)) return false;

  const { data: existing, error: existingError } = await supabase
    .from('eu_uk_order_ledger')
    .select('stripe_tax_transaction_id')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    if (!existing.stripe_tax_transaction_id && stripeTaxTransactionId) {
      const { error: updateError } = await supabase
        .from('eu_uk_order_ledger')
        .update({
          stripe_tax_transaction_id: stripeTaxTransactionId,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_payment_intent_id', paymentIntent.id);
      if (updateError) throw updateError;
    }
    return true;
  }

  const paidAt = stripeDate(paidTimestamp);
  const grossAmountCents = metadataAmount(
    paymentIntent.amount_received ?? paymentIntent.amount,
    'gross amount',
  );
  const taxAmountCents = metadataAmount(
    paymentIntent.metadata?.tax_amount_cents ?? 0,
    'tax amount',
  );
  const baseAmountCents = metadataAmount(
    paymentIntent.metadata?.base_price_cents ?? grossAmountCents - taxAmountCents,
    'base amount',
  );

  const { error } = await supabase
    .from('eu_uk_order_ledger')
    .insert({
      stripe_payment_intent_id: paymentIntent.id,
      stripe_tax_transaction_id:
        stripeTaxTransactionId ?? paymentIntent.metadata?.tax_transaction_id ?? null,
      user_id: paymentIntent.metadata?.user_id || null,
      billing_country: billingCountry,
      destination_country: String(
        paymentIntent.metadata?.destination_country ?? 'US',
      ).toUpperCase(),
      currency: String(paymentIntent.currency ?? 'usd').toLowerCase(),
      base_amount_cents: baseAmountCents,
      tax_amount_cents: taxAmountCents,
      gross_amount_cents: grossAmountCents,
      livemode: Boolean(paymentIntent.livemode),
      paid_at: paidAt.toISOString(),
      order_date: paidAt.toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
  return true;
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
    const stripeKey = event.livemode ? STRIPE_SECRET_KEY : STRIPE_SECRET_KEY_TEST;
    if (!stripeKey) {
      throw new Error(`Stripe API key is not configured for livemode=${Boolean(event.livemode)}`);
    }

    try {
      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        reportPaymentIntentId = paymentIntent.id;
        const taxResult = await recordTaxTransaction(
          stripeKey,
          paymentIntent.id,
          paymentIntent.metadata?.tax_calculation,
        );
        if (!taxResult.succeeded) {
          throw new Error(`Failed to record Stripe Tax transaction for ${paymentIntent.id}`);
        }
        await recordEuUkOrder(
          supabase,
          paymentIntent,
          taxResult.transactionId,
          event.created ?? paymentIntent.created,
        );
      } else if (event.type === 'refund.created' || event.type === 'refund.updated') {
        const refund = event.data.object;
        const paymentIntentId = String(refund.payment_intent || '');
        reportPaymentIntentId = paymentIntentId;
        if (!paymentIntentId) {
          throw new Error(`Refund ${refund.id} is missing its PaymentIntent`);
        }

        const piResponse = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
          headers: { Authorization: `Bearer ${stripeKey}` },
        });
        const paymentIntent = await piResponse.json();
        if (!piResponse.ok) {
          throw new Error(`Could not retrieve PaymentIntent ${paymentIntentId} for tax reversal`);
        }
        let taxTransactionId = paymentIntent.metadata?.tax_transaction_id;
        if (event.type === 'refund.created' && refund.amount !== paymentIntent.amount) {
          reportError(
            'stripe-webhook',
            'Partial refund needs manual tax reversal',
            'warning',
            `refundId=${refund.id}; paymentIntentId=${paymentIntentId}; refundAmount=${refund.amount}; paymentAmount=${paymentIntent.amount}`,
          );
        } else if (event.type === 'refund.created') {
          if (!taxTransactionId) {
            const taxResult = await recordTaxTransaction(
              stripeKey,
              paymentIntentId,
              paymentIntent.metadata?.tax_calculation,
            );
            taxTransactionId = taxResult.transactionId;
          }
          if (
            !taxTransactionId ||
            !await reverseTaxTransaction(stripeKey, paymentIntentId, taxTransactionId)
          ) {
            throw new Error(`Failed to reverse Stripe Tax transaction for ${paymentIntentId}`);
          }
        }

        const tracked = await recordEuUkOrder(
          supabase,
          paymentIntent,
          taxTransactionId,
          paymentIntent.created,
        );
        if (tracked) {
          const refundedAt = stripeDate(refund.created ?? event.created);
          const { error: refundError } = await supabase
            .from('eu_uk_order_refunds')
            .upsert({
              stripe_refund_id: refund.id,
              stripe_payment_intent_id: paymentIntentId,
              amount_cents: refund.amount,
              currency: String(refund.currency ?? paymentIntent.currency ?? 'usd').toLowerCase(),
              status: String(refund.status ?? 'unknown'),
              livemode: Boolean(event.livemode),
              refunded_at: refundedAt.toISOString(),
              refund_date: refundedAt.toISOString().slice(0, 10),
            }, { onConflict: 'stripe_refund_id' });
          if (refundError) throw refundError;
        }
      } else if (event.type === 'payment_intent.payment_failed') {
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
