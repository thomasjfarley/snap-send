// Edge Function: postcard-webhook
// Receives Lob.com webhook events and updates postcard status in the DB.
// Register this URL in your Lob dashboard: Settings → Webhooks

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOB_WEBHOOK_SECRET = Deno.env.get('LOB_WEBHOOK_SECRET')!;
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;

function reportError(source: string, title: string, severity: 'warning' | 'error' | 'critical', details: string, userEmail = '') {
  fetch(`${SUPABASE_URL}/functions/v1/report-error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ source, title, severity, details, userEmail }),
  }).catch(() => {});
}

// Lob event → postcard status mapping
const EVENT_STATUS_MAP: Record<string, 'submitted' | 'in_transit' | 'processed_for_delivery' | 'delivered' | 'failed'> = {
  'postcard.created': 'submitted',
  'postcard.rendered_pdf': 'submitted',
  'postcard.rendered_thumbnails': 'submitted',
  'postcard.mailed': 'in_transit',
  'postcard.in_transit': 'in_transit',
  'postcard.in_local_area': 'in_transit',
  'postcard.processed_for_delivery': 'processed_for_delivery',
  'postcard.delivered': 'delivered',
  'postcard.failed': 'failed',
  'postcard.returned_to_sender': 'failed',
};

const STATUS_RANK: Record<string, number> = {
  pending: 0,
  paid: 0,
  submitted: 1,
  mailed: 2,
  in_transit: 2,
  processed_for_delivery: 3,
  delivered: 4,
  failed: 5,
};

async function refundPaymentIntent(paymentIntentId: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `payment_intent=${paymentIntentId}`,
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[postcard-webhook] Stripe refund failed:', JSON.stringify(data));
      reportError(
        'postcard-webhook',
        'Stripe refund failed after postcard.failed',
        'error',
        `paymentIntentId=${paymentIntentId}; stripeStatus=${res.status}; response=${JSON.stringify(data).slice(0, 1000)}`,
      );
    } else {
      console.log('[postcard-webhook] Stripe refund issued:', data.id, 'for PI', paymentIntentId);
      return true;
    }
  } catch (err) {
    console.error('[postcard-webhook] Stripe refund threw:', err);
    reportError(
      'postcard-webhook',
      'Stripe refund request threw after postcard.failed',
      'error',
      `paymentIntentId=${paymentIntentId}; error=${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`,
    );
  }
  return false;
}

// Lets the customer know their order failed and has been refunded.
async function sendRefundEmail(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<void> {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    const to = data?.user?.email;
    if (error || !to) {
      console.error('[postcard-webhook] refund email: no email for user', userId, error?.message);
      return;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Snap Send <support@snapsend.live>',
        to: [to],
        subject: 'Your Snap Send order was refunded',
        text:
          "We're sorry, your postcard couldn't be printed and mailed, so we've refunded your payment in full. " +
          'The refund goes back to your original payment method and usually appears within 5-10 business days.\n\n' +
          'You can try sending it again anytime. If you have questions, just reply to this email or contact support@snapsend.live.\n\n' +
          '- The Snap Send team',
      }),
    });
    if (!res.ok) {
      console.error('[postcard-webhook] refund email failed:', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('[postcard-webhook] refund email threw:', err);
  }
}

serve(async (req) => {
  let reportEventType = '';
  let reportLobId = '';

  try {
    // Verify Lob webhook signature
    const signature = req.headers.get('lob-signature');
    if (!signature || signature !== LOB_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    const event = await req.json();
    const eventType: string = event.event_type?.id ?? '';
    const lobId: string = event.body?.id ?? '';
    reportEventType = eventType;
    reportLobId = lobId;

    const newStatus = EVENT_STATUS_MAP[eventType];
    if (!newStatus || !lobId) {
      // Not an event we care about — acknowledge it
      return new Response('ok', { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const updateData: Record<string, unknown> = { status: newStatus };

    // Fetch the postcard record so we can refund on failure
    const { data: postcard, error: fetchErr } = await supabase
      .from('postcards')
      .select('id, user_id, status, mailed_at, delivered_at, stripe_payment_intent_id')
      .eq('lob_id', lobId)
      .single();

    if (fetchErr || !postcard) {
      console.error('[postcard-webhook] Failed to fetch postcard for lob_id:', lobId, fetchErr);
      reportError(
        'postcard-webhook',
        'Failed to fetch postcard for webhook update',
        'warning',
        `eventType=${eventType}; lobId=${lobId}; error=${fetchErr?.message ?? 'postcard not found'}`,
      );
      // Still try to update status even if fetch failed
    }

    const currentStatus = postcard?.status === 'mailed' ? 'in_transit' : postcard?.status;
    const shouldAdvance =
      newStatus === 'failed'
        ? currentStatus !== 'failed'
        : !currentStatus || STATUS_RANK[newStatus] >= STATUS_RANK[currentStatus];
    if (!shouldAdvance) {
      return new Response('ok', { status: 200 });
    }
    if (
      ['in_transit', 'processed_for_delivery', 'delivered'].includes(newStatus) &&
      !postcard?.mailed_at
    ) {
      updateData.mailed_at = new Date().toISOString();
    }
    if (newStatus === 'delivered' && !postcard?.delivered_at) {
      updateData.delivered_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('postcards')
      .update(updateData)
      .eq('lob_id', lobId);

    if (error) {
      console.error('Failed to update postcard status:', error);
      reportError(
        'postcard-webhook',
        'Failed to update postcard status',
        'warning',
        `eventType=${eventType}; lobId=${lobId}; newStatus=${newStatus}; error=${error.message}`,
      );
      return new Response('DB error', { status: 500 });
    }

    // Issue a refund when Lob fails to deliver the mailpiece
    if (newStatus === 'failed' && postcard?.stripe_payment_intent_id) {
      const refunded = await refundPaymentIntent(postcard.stripe_payment_intent_id);
      if (refunded && postcard.user_id) {
        await sendRefundEmail(supabase, postcard.user_id);
      }
    }

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    reportError(
      'postcard-webhook',
      'Unhandled postcard webhook error',
      'critical',
      `eventType=${reportEventType || 'unknown'}; lobId=${reportLobId || 'unknown'}; error=${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`,
    );
    return new Response('Internal server error', { status: 500 });
  }
});
