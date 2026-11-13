// Edge Function: create-address-request
// Called by the app after the sender has paid for a "request an address by email" postcard.
// Verifies payment, moderates the image, stores the card, renders the digital copy and emails
// the recipient a private link where they can view/download the card and share their address.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isBlocked, runSafeSearch } from '../_shared/safe-search.ts';
import { recordTaxTransaction } from '../_shared/stripe-tax.ts';
import { refundPaymentIntent } from '../_shared/refund.ts';
import { inviteEmail, REQUEST_WINDOW_DAYS, sendEmail } from '../_shared/request-emails.ts';

const STRIPE_SECRET_KEY_LIVE = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_SECRET_KEY_TEST = Deno.env.get('STRIPE_SECRET_KEY_TEST')!;
const GOOGLE_VISION_API_KEY = Deno.env.get('GOOGLE_VISION_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_REGEX = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

function reportError(source: string, title: string, severity: 'warning' | 'error' | 'critical', details: string) {
  fetch(`${SUPABASE_URL}/functions/v1/report-error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ source, title, severity, details }),
  }).catch(() => {});
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function renderDigital(addressRequestId: string): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-postcard`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ addressRequestId, mode: 'render-digital' }),
  });
  if (!res.ok) {
    console.error('[create-address-request] render failed:', res.status, await res.text().catch(() => ''));
  }
  return res.ok;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let stripeKey = STRIPE_SECRET_KEY_LIVE;
  let paidIntentId: string | undefined;
  let paidUserId: string | undefined;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const {
      imageBase64, message, location, frame, filter,
      fromAddressId, recipientEmail, international, paymentIntentId, testMode,
    } = await req.json();

    const email = String(recipientEmail ?? '').trim().toLowerCase();
    if (!imageBase64 || !paymentIntentId || !fromAddressId || !EMAIL_REGEX.test(email) || email.length > 254) {
      return json({ error: 'Missing or invalid fields' }, 400);
    }
    stripeKey = testMode === true ? STRIPE_SECRET_KEY_TEST : STRIPE_SECRET_KEY_LIVE;

    // ── 1. Verify payment belongs to this user and this request ──────────────
    const piRes = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    const pi = await piRes.json();
    if (
      !piRes.ok || pi.status !== 'succeeded' || pi.metadata?.user_id !== user.id ||
      pi.metadata?.request_flow !== 'true' ||
      (pi.metadata?.request_international === 'true') !== (international === true) ||
      pi.metadata?.sender_address_id !== fromAddressId
    ) {
      return json({ error: 'Payment not confirmed' }, 402);
    }
    paidIntentId = paymentIntentId;
    paidUserId = user.id;

    // ── 2. Idempotency: a retry after a partial failure resumes the same request ─
    const { data: existing } = await supabase
      .from('address_requests')
      .select('id, token')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle();

    let requestId: string;
    let token: string;

    if (existing) {
      requestId = existing.id;
      token = existing.token;
    } else {
      const tax = await recordTaxTransaction(stripeKey, paymentIntentId, pi.metadata.tax_calculation);
      if (!tax.succeeded) {
        reportError(
          'create-address-request',
          'Stripe Tax transaction recording failed',
          'error',
          `paymentIntentId=${paymentIntentId}; userId=${user.id}`,
        );
        return json({
          error: 'We could not finalize the tax record. Your payment is safe; please retry.',
        }, 503);
      }

      const { data: fromAddress } = await supabase
        .from('addresses').select('id').eq('id', fromAddressId).eq('user_id', user.id).single();
      if (!fromAddress) {
        await refundPaymentIntent(stripeKey, paymentIntentId, user.id, 'failed');
        return json({ error: 'Sender address not found. Your payment has been refunded.' }, 404);
      }

      // ── 3. SafeSearch (LEGAL REQUIREMENT — 18 U.S.C. § 1461) ───────────────
      let moderationError: { message: string; status: number; code?: string } | null = null;
      if (!GOOGLE_VISION_API_KEY) {
        moderationError = { message: 'Content moderation unavailable.', status: 503 };
      } else {
        const { safeSearch, status, data } = await runSafeSearch(imageBase64, GOOGLE_VISION_API_KEY);
        if (!safeSearch) {
          reportError(
            'create-address-request',
            'Vision API unavailable during request creation',
            'warning',
            `paymentIntentId=${paymentIntentId}; status=${status}; body=${JSON.stringify(data).slice(0, 500)}`,
          );
          moderationError = { message: 'Content moderation unavailable.', status: 503 };
        } else if (isBlocked(safeSearch.adult) || isBlocked(safeSearch.violence)) {
          moderationError = { message: 'This image cannot be sent.', status: 422, code: 'CONTENT_REJECTED' };
        }
      }
      if (moderationError) {
        const refunded = await refundPaymentIntent(stripeKey, paymentIntentId, user.id, 'failed');
        return json({
          error: `${moderationError.message} ${refunded ? 'Your payment has been refunded.' : 'Please contact support for a refund.'}`,
          code: moderationError.code,
        }, moderationError.status);
      }

      // ── 4. Store the original image and create the request ─────────────────
      requestId = crypto.randomUUID();
      token = newToken();
      const imageBytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
      const { error: uploadError } = await supabase.storage
        .from('address-request-images')
        .upload(`${requestId}/original.jpg`, imageBytes, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) {
        reportError(
          'create-address-request',
          'Original image upload failed',
          'error',
          `paymentIntentId=${paymentIntentId}; error=${uploadError.message}`,
        );
        return json({ error: 'Failed to store your postcard. Please try again.' }, 503);
      }

      const { error: insertError } = await supabase.from('address_requests').insert({
        id: requestId,
        token,
        user_id: user.id,
        recipient_email: email,
        international: international === true,
        from_address_id: fromAddressId,
        message: String(message ?? ''),
        frame: frame ?? 'none',
        filter: filter ?? 'none',
        location: location ?? null,
        stripe_payment_intent_id: paymentIntentId,
        amount_cents: pi.amount,
        test_mode: testMode === true,
        expires_at: new Date(Date.now() + REQUEST_WINDOW_DAYS * 86_400_000).toISOString(),
      });
      if (insertError) {
        reportError(
          'create-address-request',
          'address_requests insert failed',
          'error',
          `paymentIntentId=${paymentIntentId}; error=${insertError.message}`,
        );
        return json({ error: 'Failed to save your request. Please try again.' }, 503);
      }
    }

    // ── 5. Render the digital card (retries resume here) ─────────────────────
    const { data: frontFiles } = await supabase.storage
      .from('address-request-images')
      .list(requestId, { search: 'front.jpg' });
    if (!frontFiles?.some((f) => f.name === 'front.jpg')) {
      if (!await renderDigital(requestId)) {
        reportError(
          'create-address-request',
          'Digital card render failed',
          'error',
          `requestId=${requestId}; paymentIntentId=${paymentIntentId}`,
        );
        return json({ error: 'Could not prepare your postcard. Please try again.' }, 503);
      }
    }

    // ── 6. Invite the recipient ──────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    const sent = await sendEmail({
      to: email,
      email: inviteEmail({ senderName: profile?.full_name ?? null, token }),
      idempotencyKey: `request-invite-${requestId}`,
      tag: 'request-invite',
    });
    if (!sent) {
      reportError(
        'create-address-request',
        'Recipient invite email failed',
        'error',
        `requestId=${requestId}; paymentIntentId=${paymentIntentId}`,
      );
    }

    return json({ success: true, requestId });
  } catch (err) {
    reportError(
      'create-address-request',
      'Unhandled create-address-request error',
      'critical',
      `paymentIntentId=${paidIntentId ?? 'unknown'}; userId=${paidUserId ?? 'unknown'}; error=${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`,
    );
    return json({ error: 'Internal server error' }, 500);
  }
});
