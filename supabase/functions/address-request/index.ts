// Edge Function: address-request  (PUBLIC, token-authenticated; deploy with --no-verify-jwt)
// Backs the recipient page at https://snapsend.live/r/<token>.
//   action "view"     -> card details + short-lived image URL
//   action "download" -> records digital fulfillment, returns a download URL
//   action "validate" -> Lob address verification (honouring the sender's US/international choice)
//   action "submit"   -> locks the request, saves the address to the sender's book and prints

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getAddressRestriction } from '../_shared/market-compliance.ts';
import { printRequest } from '../_shared/address-request-print.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TOKEN_REGEX = /^[A-Za-z0-9_-]{40,64}$/;
const BUCKET = 'address-request-images';
// USPS First-Class Mail International suspensions (keep in sync with constants/countries.ts).
const SUSPENDED_COUNTRIES = new Set(['AF', 'BY', 'BT', 'CU', 'ER', 'HT', 'IR', 'KI', 'CG', 'SC', 'SS', 'SD', 'TM', 'YE']);

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

const str = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const action = str(body.action, 20);
    const token = str(body.token, 80);
    if (!TOKEN_REGEX.test(token)) return json({ error: 'not_found' }, 404);

    const { data: row } = await supabase
      .from('address_requests')
      .select('*')
      .eq('token', token)
      .maybeSingle();
    if (!row) return json({ error: 'not_found' }, 404);

    const expired = new Date(row.expires_at).getTime() <= Date.now();
    const closed = expired || row.status === 'refunded' || row.status === 'expired_digital';
    const addressTaken = row.status !== 'awaiting_address';

    if (action === 'view') {
      const { data: profile } = await supabase
        .from('profiles').select('full_name').eq('id', row.user_id).maybeSingle();
      if (closed) {
        return json({ state: 'expired', senderName: profile?.full_name ?? null });
      }
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(`${row.id}/front.jpg`, 3600);
      return json({
        state: addressTaken ? 'address_received' : 'awaiting_address',
        senderName: profile?.full_name ?? null,
        message: row.message,
        location: row.location,
        international: row.international,
        imageUrl: signed?.signedUrl ?? null,
        expiresAt: row.expires_at,
        downloaded: !!row.downloaded_at,
      });
    }

    if (action === 'download') {
      if (closed) return json({ error: 'expired' }, 410);
      const { data: signed, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(`${row.id}/front.jpg`, 300, { download: 'snap-send-postcard.jpg' });
      if (error || !signed) return json({ error: 'unavailable' }, 503);
      // Record fulfillment only once we are actually handing out the file.
      if (!row.downloaded_at) {
        await supabase
          .from('address_requests')
          .update({ downloaded_at: new Date().toISOString() })
          .eq('id', row.id)
          .is('downloaded_at', null);
      }
      return json({ url: signed.signedUrl });
    }

    if (action === 'validate' || action === 'submit') {
      if (closed) return json({ error: 'expired' }, 410);
      if (addressTaken) return json({ error: 'already_submitted' }, 409);

      const input = body.address ?? {};
      const address = {
        full_name: str(input.full_name, 100),
        line1: str(input.line1, 100),
        line2: str(input.line2, 100) || null,
        city: str(input.city, 60),
        state: str(input.state, 60),
        zip: str(input.zip, 20),
        country: str(input.country || 'US', 2).toUpperCase(),
      };
      if (!address.full_name || !address.line1 || !address.city || !address.zip) {
        return json({ error: 'Please fill in your name and full address.' }, 400);
      }
      if (!/^[A-Z]{2}$/.test(address.country)) {
        return json({ error: 'Invalid country.' }, 400);
      }
      if (row.international === (address.country === 'US')) {
        return json({
          error: row.international
            ? 'This postcard is being sent internationally, so please enter an address outside the United States.'
            : 'This postcard is being sent within the United States, so please enter a US address.',
        }, 422);
      }
      const restriction = getAddressRestriction(address);
      if (restriction) return json({ error: restriction }, 422);
      if (SUSPENDED_COUNTRIES.has(address.country)) {
        return json({ error: 'USPS has temporarily suspended mail to this country, so we cannot send a postcard there.' }, 422);
      }

      const verifyRes = await fetch(`${SUPABASE_URL}/functions/v1/validate-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ ...address, testMode: row.test_mode }),
      });
      const verification = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok) {
        return json({ error: verification?.error ?? 'Address verification failed' }, verifyRes.status === 422 ? 422 : 502);
      }

      if (action === 'validate') {
        return json({
          verified: !!verification.verified,
          deliverability: verification.deliverability ?? null,
          address: verification.address ? { ...address, ...verification.address } : address,
          // US addresses Lob can't verify (rural Alaska, tribal lands) may still be mailed with a warning
          canSendUnverified: !verification.verified && address.country === 'US',
        });
      }

      // ── submit ─────────────────────────────────────────────────────────────
      const acceptUnverified = body.acceptUnverified === true && address.country === 'US';
      if (!verification.verified && !acceptUnverified) {
        return json({ error: 'We could not verify that address. Please check it or confirm you want to send anyway.' }, 422);
      }
      // The standardized address from Lob is what gets printed; fall back to what was typed.
      const finalAddress = verification.verified && verification.address
        ? { ...address, ...verification.address, full_name: address.full_name }
        : address;

      // Atomic lock: only one submission can ever win.
      const { data: locked } = await supabase
        .from('address_requests')
        .update({ status: 'processing', address_submitted_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('status', 'awaiting_address')
        .gt('expires_at', new Date().toISOString())
        .select('id')
        .maybeSingle();
      if (!locked) return json({ error: 'already_submitted' }, 409);

      const { data: saved, error: saveError } = await supabase
        .from('addresses')
        .insert({
          user_id: row.user_id,
          label: 'Friend',
          full_name: finalAddress.full_name,
          line1: finalAddress.line1,
          line2: finalAddress.line2,
          city: finalAddress.city,
          state: finalAddress.state ?? '',
          zip: String(finalAddress.zip),
          country: finalAddress.country,
          lob_verified: !!verification.verified,
          is_personal: false,
        })
        .select('id')
        .single();
      if (saveError || !saved) {
        // Release the lock so the recipient can try again.
        await supabase
          .from('address_requests')
          .update({ status: 'awaiting_address', address_submitted_at: null })
          .eq('id', row.id);
        reportError('address-request', 'Saving recipient address failed', 'error',
          `requestId=${row.id}; error=${saveError?.message ?? 'no row'}`);
        return json({ error: 'Something went wrong saving your address. Please try again.' }, 503);
      }
      await supabase.from('address_requests').update({ to_address_id: saved.id }).eq('id', row.id);

      // Print now; if it fails the daily job retries, then refunds the sender.
      await printRequest(supabase, row.id);

      return json({ success: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    reportError(
      'address-request',
      'Unhandled address-request error',
      'critical',
      `error=${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`,
    );
    return json({ error: 'Internal server error' }, 500);
  }
});
