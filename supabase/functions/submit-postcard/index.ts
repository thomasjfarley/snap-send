// Edge Function: submit-postcard
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const LOB_API_KEY = Deno.env.get('LOB_API_KEY')!;
const GOOGLE_VISION_API_KEY = Deno.env.get('GOOGLE_VISION_API_KE');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const LOB_BASE_URL = 'https://api.lob.com/v1';
const LIKELIHOOD_LEVELS = ['UNKNOWN', 'VERY_UNLIKELY', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'VERY_LIKELY'];
const BLOCK_THRESHOLD = 'LIKELY';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isBlocked(likelihood: string): boolean {
  return LIKELIHOOD_LEVELS.indexOf(likelihood) >= LIKELIHOOD_LEVELS.indexOf(BLOCK_THRESHOLD);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let tempImagePath: string | null = null;

  try {
    // ── 1. Auth ───────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const {
      imageBase64, message, frame, filter,
      fromAddressId, toAddressId, recipientSnapshot, paymentIntentId,
    } = await req.json();

    if (!imageBase64 || !paymentIntentId || !fromAddressId || !toAddressId) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    // ── 2. Verify Stripe payment ──────────────────────────────────────────────
    const piRes = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const pi = await piRes.json();
    if (!piRes.ok || pi.status !== 'succeeded' || pi.metadata?.user_id !== user.id) {
      return jsonResponse({ error: 'Payment not confirmed' }, 402);
    }

    // ── 3. SafeSearch (LEGAL REQUIREMENT — 18 U.S.C. § 1461) ─────────────────
    if (GOOGLE_VISION_API_KEY) {
      const visionRes = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{ image: { content: imageBase64 }, features: [{ type: 'SAFE_SEARCH_DETECTION' }] }],
          }),
        },
      );
      const visionData = await visionRes.json();
      const safeSearch = visionData.responses?.[0]?.safeSearchAnnotation;
      if (!safeSearch) {
        console.error('Vision API failed:', JSON.stringify(visionData));
        return jsonResponse({ error: 'Content moderation unavailable. Please try again.' }, 503);
      }
      if (isBlocked(safeSearch.adult) || isBlocked(safeSearch.violence)) {
        return jsonResponse({ error: 'This image cannot be sent.', code: 'CONTENT_REJECTED' }, 422);
      }
    } else {
      console.warn('GOOGLE_VISION_API_KEY not set — skipping SafeSearch (dev only)');
    }

    // ── 4. Fetch sender address ───────────────────────────────────────────────
    const { data: fromAddress, error: fromErr } = await supabase
      .from('addresses').select('*')
      .eq('id', fromAddressId).eq('user_id', user.id).single();
    if (fromErr || !fromAddress) return jsonResponse({ error: 'Sender address not found' }, 404);

    // ── 5. Upload image to Storage so Lob can fetch via URL ───────────────────
    // Lob's inline HTML limit is 10,000 chars; base64 images far exceed that.
    tempImagePath = `temp/${user.id}/${Date.now()}.jpg`;
    const rawImageBytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));

    // Apply print-compensating corrections before sending to Lob.
    // Lob's CMYK pre-press rendering crushes shadows and oversaturates warm
    // tones relative to the screen-calibrated source image. We pre-correct:
    //   • gamma 1.3  — lifts dark tones, recovering shadow detail (applied
    //     directly to bitmap: out = (in/255)^(1/1.3) * 255)
    //   • saturation 0.88 — −12% chroma, normalises skin tones (via HSL)
    let imageBytes: Uint8Array;
    try {
      const img = await Image.decode(rawImageBytes);

      // Gamma correction: apply power curve directly to RGB channels.
      // imagescript has no built-in gamma(); we manipulate bitmap bytes.
      const GAMMA = 1.3;
      const EXP = 1 / GAMMA; // 0.625
      // Build a 256-entry LUT so we only compute Math.pow 256 times.
      const lut = new Uint8ClampedArray(256);
      for (let v = 0; v < 256; v++) lut[v] = Math.round(Math.pow(v / 255, EXP) * 255);
      const bmp = img.bitmap;
      for (let i = 0; i < bmp.length; i += 4) {
        bmp[i]     = lut[bmp[i]];     // R
        bmp[i + 1] = lut[bmp[i + 1]]; // G
        bmp[i + 2] = lut[bmp[i + 2]]; // B
        // i+3 is alpha — leave unchanged
      }

      // Saturation reduction via imagescript's HSL-based saturation()
      img.saturation(0.88);

      imageBytes = await img.encodeJPEG(95);
    } catch (correctionErr) {
      console.warn('[submit-postcard] print correction failed, using original bytes:', correctionErr);
      imageBytes = rawImageBytes;
    }

    const { error: uploadError } = await supabase.storage
      .from('postcard-fronts')
      .upload(tempImagePath, imageBytes, { contentType: 'image/jpeg', upsert: true });

    if (uploadError) {
      console.error('Storage upload failed:', uploadError);
      return jsonResponse({ error: 'Failed to process image' }, 500);
    }

    const { data: { publicUrl: frontUrl } } = supabase.storage
      .from('postcard-fronts')
      .getPublicUrl(tempImagePath);

    // ── 6. Send postcard via Lob ──────────────────────────────────────────────
    const lobCredentials = btoa(`${LOB_API_KEY}:`);
    const normalizedMessage = (message ?? '').trim().replace(/\n{2,}/g, '\n');
    const safeMessage = normalizedMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const msgLen = normalizedMessage.length;
    const lobFontSize = msgLen < 100 ? 16 : msgLen < 250 ? 15 : msgLen < 400 ? 14 : 13;

    const lobBody = {
      description: 'Snap Send postcard',
      size: '4x6',
      use_type: 'operational',
      front: frontUrl,
      back: `<html><body style="margin:0;padding:0;font-family:Helvetica,Arial,sans-serif"><table style="width:100%;height:100%;border-collapse:collapse;table-layout:fixed"><tr><td style="width:44%;vertical-align:top;padding:18px 14px;border-right:1px solid #ccc"><p style="font-size:${lobFontSize}px;line-height:1.5;color:#333;margin:0;white-space:pre-wrap">${safeMessage}</p></td><td style="width:56%;vertical-align:top;padding:0"><table style="width:100%;border-collapse:collapse"><tr><td style="text-align:center;padding:28px 14px 20px 14px"><p style="font-size:8px;font-weight:bold;color:#444;margin:0 0 8px 0;letter-spacing:2px;text-transform:uppercase">Snap Send</p><img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&color=222222&bgcolor=ffffff&data=https://snapsend.live" width="80" height="80" style="display:block;margin:0 auto" /><p style="font-size:8px;color:#888;margin:8px 0 0 0;letter-spacing:1px">Send Joy</p></td></tr><tr><td style="padding:0 14px"><hr style="border:none;border-top:1px solid #ddd;margin:0" /></td></tr><tr><td style="padding:10px 14px 0 14px">{{from_address}}</td></tr><tr><td style="padding:6px 14px 10px 14px">{{to_address}}</td></tr></table></td></tr></table></body></html>`,
      to: {
        name: recipientSnapshot.full_name,
        address_line1: recipientSnapshot.line1,
        ...(recipientSnapshot.line2 ? { address_line2: recipientSnapshot.line2 } : {}),
        address_city: recipientSnapshot.city,
        address_state: recipientSnapshot.state,
        address_zip: String(recipientSnapshot.zip),
        address_country: 'US',
      },
      from: {
        name: fromAddress.full_name,
        address_line1: fromAddress.line1,
        ...(fromAddress.line2 ? { address_line2: fromAddress.line2 } : {}),
        address_city: fromAddress.city,
        address_state: fromAddress.state,
        address_zip: String(fromAddress.zip),
        address_country: 'US',
      },
    };

    const lobRes = await fetch(`${LOB_BASE_URL}/postcards`, {
      method: 'POST',
      headers: { Authorization: `Basic ${lobCredentials}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(lobBody),
    });
    const lobData = await lobRes.json();

    // Clean up temp image regardless of Lob result
    await supabase.storage.from('postcard-fronts').remove([tempImagePath]);
    tempImagePath = null;

    if (!lobRes.ok) {
      const lobErr = `Lob ${lobRes.status}: ${JSON.stringify(lobData)}`;
      console.error(lobErr);
      return jsonResponse({ error: 'Failed to create postcard', lob_status: lobRes.status, lob_detail: lobData }, 502);
    }

    // ── 7. Record in database ─────────────────────────────────────────────────
    const { data: postcard, error: insertErr } = await supabase
      .from('postcards')
      .insert({
        user_id: user.id, message,
        frame: frame ?? 'none', filter: filter ?? 'none',
        from_address_id: fromAddressId, to_address_id: toAddressId,
        recipient_snapshot: recipientSnapshot, status: 'submitted',
        lob_id: lobData.id, stripe_payment_intent_id: paymentIntentId,
        price_cents: pi.amount,
      })
      .select().single();

    if (insertErr || !postcard) {
      console.error('DB insert failed after Lob success:', insertErr);
      return jsonResponse({ success: true, lobId: lobData.id, postcardId: null, warning: 'DB record failed' });
    }

    await supabase.from('orders').insert({
      user_id: user.id, postcard_id: postcard.id,
      stripe_payment_intent_id: paymentIntentId,
      amount_cents: pi.amount, status: 'succeeded',
    });

    return jsonResponse({ success: true, postcardId: postcard.id, lobId: lobData.id });

  } catch (err) {
    if (tempImagePath) {
      await supabase.storage.from('postcard-fronts').remove([tempImagePath]).catch(() => {});
    }
    console.error('Unhandled error:', err);
    return jsonResponse({ error: 'Internal server error', detail: String(err) }, 500);
  }
});
