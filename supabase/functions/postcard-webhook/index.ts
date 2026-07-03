// Edge Function: postcard-webhook
// Receives Lob.com webhook events and updates postcard status in the DB.
// Register this URL in your Lob dashboard: Settings → Webhooks

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOB_WEBHOOK_SECRET = Deno.env.get('LOB_WEBHOOK_SECRET')!;
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;

// Lob event → postcard status mapping
const EVENT_STATUS_MAP: Record<string, 'submitted' | 'mailed' | 'delivered' | 'failed'> = {
  'postcard.created': 'submitted',
  'postcard.rendered_pdf': 'submitted',
  'postcard.rendered_thumbnails': 'submitted',
  'postcard.in_transit': 'mailed',
  'postcard.in_local_area': 'mailed',
  'postcard.processed_for_delivery': 'delivered',
  'postcard.delivered': 'delivered',
  'postcard.failed': 'failed',
  'postcard.returned_to_sender': 'failed',
};

async function refundPaymentIntent(paymentIntentId: string): Promise<void> {
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
    } else {
      console.log('[postcard-webhook] Stripe refund issued:', data.id, 'for PI', paymentIntentId);
    }
  } catch (err) {
    console.error('[postcard-webhook] Stripe refund threw:', err);
  }
}

serve(async (req) => {
  try {
    // Verify Lob webhook signature
    const signature = req.headers.get('lob-signature');
    if (!signature || signature !== LOB_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    const event = await req.json();
    const eventType: string = event.event_type?.id ?? '';
    const lobId: string = event.body?.id ?? '';

    const newStatus = EVENT_STATUS_MAP[eventType];
    if (!newStatus || !lobId) {
      // Not an event we care about — acknowledge it
      return new Response('ok', { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'mailed') {
      updateData.mailed_at = new Date().toISOString();
    }
    if (newStatus === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    // Fetch the postcard record so we can refund on failure
    const { data: postcard, error: fetchErr } = await supabase
      .from('postcards')
      .select('id, stripe_payment_intent_id')
      .eq('lob_id', lobId)
      .single();

    if (fetchErr || !postcard) {
      console.error('[postcard-webhook] Failed to fetch postcard for lob_id:', lobId, fetchErr);
      // Still try to update status even if fetch failed
    }

    const { error } = await supabase
      .from('postcards')
      .update(updateData)
      .eq('lob_id', lobId);

    if (error) {
      console.error('Failed to update postcard status:', error);
      return new Response('DB error', { status: 500 });
    }

    // Issue a refund when Lob fails to deliver the mailpiece
    if (newStatus === 'failed' && postcard?.stripe_payment_intent_id) {
      await refundPaymentIntent(postcard.stripe_payment_intent_id);
    }

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('Internal server error', { status: 500 });
  }
});
