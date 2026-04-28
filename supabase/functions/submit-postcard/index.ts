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

// ── Frame and filter definitions (mirrors constants/editor.ts) ────────────────
const FRAMES_DATA = [
  { id: 'none',     borderWidth: 0,  borderColor: 'transparent', padding: 0 },
  { id: 'classic',  borderWidth: 14, borderColor: '#FFFFFF',      padding: 0 },
  { id: 'vintage',  borderWidth: 14, borderColor: '#D4B896',      padding: 3 },
  { id: 'polaroid', borderWidth: 6,  borderColor: '#F5F5F0',      padding: 0 },
  { id: 'minimal',  borderWidth: 3,  borderColor: '#222222',      padding: 0 },
  { id: 'travel',   borderWidth: 10, borderColor: '#2D6A4F',      padding: 2 },
] as const;

const FILTERS_DATA: Record<string, readonly number[] | null> = {
  none:  null,
  warm:  [1.2, 0.1,  0,    0, 0,    0,   1.0,  0,    0, 0,    0,   0,    0.8,  0, 0,    0, 0, 0, 1, 0],
  cool:  [0.8, 0,    0,    0, 0,    0,   1.0,  0.1,  0, 0,    0,   0,    1.2,  0, 0,    0, 0, 0, 1, 0],
  bw:    [0.33,0.33, 0.33, 0, 0,    0.33,0.33, 0.33, 0, 0,    0.33,0.33, 0.33, 0, 0,    0, 0, 0, 1, 0],
  fade:  [0.8, 0,    0,    0, 0.1,  0,   0.8,  0,    0, 0.1,  0,   0,    0.8,  0, 0.1,  0, 0, 0, 1, 0],
  vivid: [1.4,-0.2, -0.2,  0, 0,   -0.2, 1.4, -0.2,  0, 0,   -0.2,-0.2,  1.4,  0, 0,    0, 0, 0, 1, 0],
};

// ── Module-level font cache ───────────────────────────────────────────────────
// The previous URL (roboto-fontface@0.10.0/fonts/roboto/Roboto-Regular.ttf) 404s
// on jsdelivr — the correct path uses capital "Roboto". We try several
// well-known mirrors so a single CDN outage / path change cannot silently
// disable the location badge (the previous symptom).
const FONT_URLS = [
  'https://cdn.jsdelivr.net/gh/openmaptiles/fonts/roboto/Roboto-Regular.ttf',
  'https://cdn.jsdelivr.net/npm/roboto-fontface@0.10.0/fonts/Roboto/Roboto-Regular.ttf',
  'https://cdn.jsdelivr.net/gh/googlefonts/roboto@main/src/hinted/Roboto-Regular.ttf',
];
let fontBuffer: Uint8Array | null = null;
async function getFont(): Promise<Uint8Array | null> {
  if (fontBuffer) return fontBuffer;
  for (const url of FONT_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`[submit-postcard] font fetch ${res.status}: ${url}`);
        continue;
      }
      fontBuffer = new Uint8Array(await res.arrayBuffer());
      return fontBuffer;
    } catch (err) {
      console.error(`[submit-postcard] font fetch threw for ${url}:`, err);
    }
  }
  console.error('[submit-postcard] all font sources failed; location badge will be skipped');
  return null;
}

// ── Helper: round the corners of an imagescript Image via pixel masking ──────
// imagescript has no native rounded-rect fill; we mask corner pixels manually.
// Coordinates are 1-indexed (imagescript convention).
function roundCorners(image: InstanceType<typeof Image>, radius: number): void {
  const w = image.width, h = image.height;
  for (let y = 1; y <= h; y++) {
    for (let x = 1; x <= w; x++) {
      const xi = x - 1, yi = y - 1;
      const inCorner =
        (xi < radius && yi < radius) ||
        (xi >= w - radius && yi < radius) ||
        (xi < radius && yi >= h - radius) ||
        (xi >= w - radius && yi >= h - radius);
      if (inCorner) {
        const cx = xi < radius ? radius : w - 1 - radius;
        const cy = yi < radius ? radius : h - 1 - radius;
        if (Math.sqrt((xi - cx) ** 2 + (yi - cy) ** 2) > radius) {
          image.setPixelAt(x, y, 0); // fully transparent
        }
      }
    }
  }
}

// ── Helper: draw a white location-pin icon (circle head + tapered tail) ───────
// Uses the same proportions as the React Native PinIcon component in preview.tsx
// so the badge looks consistent between the in-app preview and the Lob print.
// All coordinates use imagescript's 1-indexed convention.
function createPinIcon(h: number): InstanceType<typeof Image> {
  const r = Math.round(h * 0.32);
  const w = r * 2 + 2;   // +2 so the circle doesn't clip at edges
  const cx = w / 2;       // circle center x (0-indexed float)
  const cy = r + 1;       // circle center y (0-indexed float)
  const icon = new Image(w, h);
  for (let iy = 1; iy <= h; iy++) {
    for (let ix = 1; ix <= w; ix++) {
      const px = ix - 0.5;  // pixel center, 0-indexed
      const py = iy - 0.5;
      const inCircle = (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
      let inTail = false;
      if (!inCircle && py > cy) {
        const t = (py - cy) / (h - cy);
        inTail = Math.abs(px - cx) <= r * (1 - t);
      }
      if (inCircle || inTail) {
        icon.setPixelAt(ix, iy, 0xFFFFFFFF);
      }
    }
  }
  return icon;
}

// ── Helper: parse #RRGGBB hex → 32-bit RGBA (imagescript format) ──────────────
function hexToRGBA(hex: string, alpha = 255): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return (((r << 24) | (g << 16) | (b << 8) | alpha) >>> 0);
}

// ── Helper: apply a 5×4 color matrix to bitmap bytes in-place ────────────────
// Matrix layout matches CSS feColorMatrix (20 elements, 5 cols × 4 rows).
// Bias column (indices 4,9,14,19) is in [0..1] scale (1 = 255).
function applyColorMatrix(bmp: Uint8Array, m: readonly number[]) {
  for (let i = 0; i < bmp.length; i += 4) {
    const r = bmp[i], g = bmp[i + 1], b = bmp[i + 2];
    bmp[i]     = Math.min(255, Math.max(0, Math.round(m[0]  * r + m[1]  * g + m[2]  * b + m[4]  * 255)));
    bmp[i + 1] = Math.min(255, Math.max(0, Math.round(m[5]  * r + m[6]  * g + m[7]  * b + m[9]  * 255)));
    bmp[i + 2] = Math.min(255, Math.max(0, Math.round(m[10] * r + m[11] * g + m[12] * b + m[14] * 255)));
    // alpha (i+3) unchanged
  }
};

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
    const {
      imageBase64, message, location, frame, filter,
      fromAddressId, toAddressId, recipientSnapshot, paymentIntentId,
    } = await req.json();

    if (!imageBase64 || !paymentIntentId || !fromAddressId || !toAddressId) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    // ── 1. Verify Stripe payment and extract user identity ────────────────────
    const piRes = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const pi = await piRes.json();
    if (!piRes.ok || pi.status !== 'succeeded' || !pi.metadata?.user_id) {
      return jsonResponse({ error: 'Payment not confirmed' }, 402);
    }
    const userId = pi.metadata.user_id;

    // ── 2. SafeSearch (LEGAL REQUIREMENT — 18 U.S.C. § 1461) ─────────────────
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

    // ── 3. Fetch sender address ───────────────────────────────────────────────
    const { data: fromAddress, error: fromErr } = await supabase
      .from('addresses').select('*')
      .eq('id', fromAddressId).eq('user_id', userId).single();
    if (fromErr || !fromAddress) return jsonResponse({ error: 'Sender address not found' }, 404);

    // ── 4. Upload image to Storage so Lob can fetch via URL ───────────────────
    // Lob's inline HTML limit is 10,000 chars; base64 images far exceed that.
    tempImagePath = `temp/${userId}/${Date.now()}.jpg`;
    const rawImageBytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));

    // Apply print-compensating corrections before sending to Lob.
    // Lob's CMYK pre-press rendering crushes shadows and oversaturates warm
    // tones relative to the screen-calibrated source image. We pre-correct:
    //   • filter color matrix (if any) — applied first so corrections normalize the result
    //   • frame border         (if any) — canvas expansion around the photo
    //   • gamma 1.3  — lifts dark tones, recovering shadow detail
    //   • saturation 0.88 — −12% chroma, normalises skin tones
    //   • cover() normalization to exact Lob dimensions (1875×1275)
    //   • location badge (if any) — composited LAST so it is not dulled by
    //     gamma/saturation and not cropped by cover()
    let imageBytes: Uint8Array;
    try {
      let img = await Image.decode(rawImageBytes);

      // ── Filter: apply color matrix ─────────────────────────────────────────
      try {
        const filterMatrix = filter && filter !== 'none' ? FILTERS_DATA[filter] ?? null : null;
        if (filterMatrix) {
          applyColorMatrix(img.bitmap, filterMatrix);
        }
      } catch (stepErr) {
        console.error('[submit-postcard] filter step failed:', stepErr);
      }

      // ── Frame: paint border IN-PLACE over image edges (no canvas expansion) ──
      // Expanding the canvas changes dimensions and causes Lob to reject with 422.
      try {
        const frameDef = FRAMES_DATA.find((f) => f.id === frame);
        if (frameDef && frameDef.borderWidth > 0) {
          const scale = img.width / 327;
          // Lob bleeds 0.125" on each side (37.5px at 300 DPI on a 1875px image).
          // We add that offset so the visible border after bleed matches the CSS preview.
          const BLEED_PX = Math.round(0.125 * (img.width / 6.25)); // ~38px for 1875px images
          const borderPx = Math.round((frameDef.borderWidth + frameDef.padding) * scale) + BLEED_PX;
          const rawColor = hexToRGBA(frameDef.borderColor === 'transparent' ? '#FFFFFF' : frameDef.borderColor);
          const fr = (rawColor >>> 24) & 0xFF;
          const fg = (rawColor >>> 16) & 0xFF;
          const fb = (rawColor >>> 8)  & 0xFF;
          const fa = rawColor & 0xFF;
          const bmp = img.bitmap;
          const W = img.width, H = img.height;
          for (let py = 0; py < H; py++) {
            for (let px = 0; px < W; px++) {
              if (px < borderPx || px >= W - borderPx || py < borderPx || py >= H - borderPx) {
                const i = (py * W + px) * 4;
                bmp[i] = fr; bmp[i + 1] = fg; bmp[i + 2] = fb; bmp[i + 3] = fa;
              }
            }
          }
        }
      } catch (stepErr) {
        console.error('[submit-postcard] frame step failed:', stepErr);
      }

      // ── Gamma correction ───────────────────────────────────────────────────
      try {
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
      } catch (stepErr) {
        console.error('[submit-postcard] gamma step failed:', stepErr);
      }

      // Saturation reduction via imagescript's HSL-based saturation()
      try {
        img.saturation(0.88);
      } catch (stepErr) {
        console.error('[submit-postcard] saturation step failed:', stepErr);
      }

      // ── Guard: normalize to exact Lob dimensions (1875×1275) ─────────────
      // Catches portrait source images (EXIF orientation not applied client-side)
      // or any other unexpected dimension drift.
      const LOB_FINAL_W = 1875, LOB_FINAL_H = 1275;
      try {
        if (img.width !== LOB_FINAL_W || img.height !== LOB_FINAL_H) {
          img = img.cover(LOB_FINAL_W, LOB_FINAL_H);
        }
      } catch (stepErr) {
        console.error('[submit-postcard] cover resize failed:', stepErr);
      }

      // ── Location badge: Instagram-style pill, bottom-left ────────────────
      // White pin icon + location text on a dark semi-translucent background.
      // Drawn LAST so it's unaffected by any earlier color corrections.
      // Mirrors the PinIcon component + locationBadge style in preview.tsx.
      if (location) {
        try {
          const font = await getFont();
          if (!font) {
            console.error('[submit-postcard] location badge skipped: font unavailable');
          } else {
            const badgeFontSize = Math.round(img.width * 0.022);    // ~41px on 1875-wide
            const badgePad     = Math.round(badgeFontSize * 0.55);  // ~22px
            const inset        = Math.round(img.width * 0.040);     // ~75px — matches reference positioning
            const iconGap      = Math.round(badgePad * 0.4);        // gap between pin and text

            const textImg = await Image.renderText(font, badgeFontSize, String(location), 0xFFFFFFFF);
            const iconH   = Math.round(badgeFontSize * 1.3);
            const pinIcon = createPinIcon(iconH);
            const iconW   = pinIcon.width;

            const badgeH = textImg.height + badgePad * 2;
            const badgeW = badgePad + iconW + iconGap + textImg.width + badgePad;

            const badge = new Image(badgeW, badgeH);
            badge.fill(0x000000A6);  // ~65% opacity — matches rgba(0,0,0,0.65) in preview

            // Composite pin icon: vertically centered
            const iconY = Math.max(1, Math.round((badgeH - iconH) / 2));
            badge.composite(pinIcon, badgePad, iconY);

            // Composite text: vertically centered
            const textY = Math.max(1, Math.round((badgeH - textImg.height) / 2));
            badge.composite(textImg, badgePad + iconW + iconGap, textY);

            // Full pill shape
            roundCorners(badge, Math.round(badgeH / 2));

            img.composite(badge, inset, img.height - badgeH - inset);
          }
        } catch (badgeErr) {
          console.error('[submit-postcard] location badge render failed:', badgeErr);
        }
      }

      imageBytes = await img.encodeJPEG(95);
    } catch (correctionErr) {
      console.error('[submit-postcard] print correction failed, using original bytes:', correctionErr);
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

    // ── 5. Send postcard via Lob ──────────────────────────────────────────────
    const lobCredentials = btoa(`${LOB_API_KEY}:`);
    const normalizedMessage = (message ?? '').trim();
    const safeMessage = normalizedMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeLocation = location ? String(location).replace(/</g, '&lt;').replace(/>/g, '&gt;') : null;
    const msgLen = normalizedMessage.length;
    const lineCount = safeMessage.split('\n').length;
    const LOB_CHARS_PER_LINE = 40;
    const visualLines = safeMessage
      .split('\n')
      .reduce((sum: number, line: string) => sum + Math.max(1, Math.ceil(line.length / LOB_CHARS_PER_LINE)), 0);
    const sizeByChars = msgLen < 80 ? 15 : msgLen < 200 ? 13 : msgLen < 350 ? 11 : 10;
    const sizeByLines = lineCount <= 5 ? 15 : lineCount <= 9 ? 13 : lineCount <= 13 ? 11 : 10;
    const sizeByVisual = visualLines <= 7 ? 15 : visualLines <= 12 ? 13 : visualLines <= 17 ? 11 : 10;
    const lobFontSize = Math.min(sizeByChars, sizeByLines, sizeByVisual);

    // Build inline address blocks — {{from_address}}/{{to_address}} merge vars
    // only work with Lob's Templates API, not inline HTML.
    function addrBlock(label: string, a: { full_name: string; line1: string; line2?: string; city: string; state: string; zip: string }) {
      const esc = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const line2 = a.line2 ? `<br>${esc(a.line2)}` : '';
      return `<p style="font-size:7px;line-height:1.5;color:#555;margin:0"><span style="font-size:6px;color:#999;text-transform:uppercase;letter-spacing:1px">${label}</span><br><strong>${esc(a.full_name)}</strong><br>${esc(a.line1)}${line2}<br>${esc(a.city)}, ${esc(a.state)} ${esc(String(a.zip))}</p>`;
    }
    const fromHtml = addrBlock('FROM', fromAddress);
    const toHtml = addrBlock('TO', recipientSnapshot);

    const lobBody = {
      description: 'Snap Send postcard',
      size: '4x6',
      use_type: 'operational',
      front: frontUrl,
      back: `<html><body style="margin:0;padding:0;font-family:Helvetica,Arial,sans-serif"><table style="width:100%;height:100%;border-collapse:collapse;table-layout:fixed"><tr><td style="width:44%;vertical-align:top;padding:24px 10px 24px 24px"><p style="font-size:${lobFontSize}px;line-height:1.5;color:#333;margin:0;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word">${safeMessage}</p></td><td style="width:56%;vertical-align:top;padding:0"><table style="width:100%;border-collapse:collapse"><tr><td style="text-align:center;padding:28px 14px 20px 14px"><p style="font-size:8px;font-weight:bold;color:#444;margin:0 0 8px 0;letter-spacing:2px;text-transform:uppercase">Snap Send</p><img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&color=222222&bgcolor=ffffff&data=https://snapsend.live" width="80" height="80" style="display:block;margin:0 auto" /><p style="font-size:8px;color:#888;margin:8px 0 0 0;letter-spacing:1px">Send Joy</p></td></tr><tr><td style="padding:0 14px"><hr style="border:none;border-top:1px solid #ddd;margin:0" /></td></tr><tr><td style="padding:10px 14px 4px 14px">${fromHtml}</td></tr><tr><td style="padding:4px 14px 10px 14px">${toHtml}</td></tr></table></td></tr></table></body></html>`,
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
      const lobErrMsg = lobData?.error?.message ?? lobData?.message ?? JSON.stringify(lobData).slice(0, 300);
      console.error(`Lob ${lobRes.status}:`, JSON.stringify(lobData));
      return jsonResponse({ error: `Lob ${lobRes.status}: ${lobErrMsg}`, lob_status: lobRes.status, lob_detail: lobData }, 502);
    }

    // ── 6. Record in database ─────────────────────────────────────────────────
    const { data: postcard, error: insertErr } = await supabase
      .from('postcards')
      .insert({
        user_id: userId, message,
        frame: frame ?? 'none', filter: filter ?? 'none',
        location: location ?? null,
        from_address_id: fromAddressId, to_address_id: toAddressId,
        recipient_snapshot: recipientSnapshot, status: 'submitted',
        lob_id: lobData.id,
        lob_front_url: (lobData.thumbnails?.[0]?.medium ?? null) as string | null,
        lob_back_url: (lobData.thumbnails?.[1]?.medium ?? null) as string | null,
        stripe_payment_intent_id: paymentIntentId,
        price_cents: pi.amount,
      })
      .select().single();

    if (insertErr || !postcard) {
      console.error('DB insert failed after Lob success:', insertErr);
      return jsonResponse({ success: true, lobId: lobData.id, postcardId: null, warning: 'DB record failed' });
    }

    await supabase.from('orders').insert({
      user_id: userId, postcard_id: postcard.id,
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
