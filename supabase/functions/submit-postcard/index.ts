// Edge Function: submit-postcard
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

const STRIPE_SECRET_KEY_LIVE = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_SECRET_KEY_TEST = Deno.env.get('STRIPE_SECRET_KEY_TEST')!;
const LOB_API_KEY_LIVE = Deno.env.get('LOB_API_KEY')!;
const LOB_API_KEY_TEST = Deno.env.get('LOB_API_KEY_TEST')!;
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

// ── Precomputed gamma LUT (γ=1.3 correction, computed once per worker) ────────
const GAMMA_LUT = new Uint8ClampedArray(256);
for (let v = 0; v < 256; v++) GAMMA_LUT[v] = Math.round(Math.pow(v / 255, 1 / 1.3) * 255);

// ── Precomputed saturation matrix (s=0.88, ITU-R BT.709 luma weights) ─────────
// Linear-RGB approximation: factor f=1-s=0.12; Lr=0.2126, Lg=0.7152, Lb=0.0722
// Each row sums to 1.0, so outputs stay in [0,255] — no clamp needed in theory.
const SAT_M = [
  0.905512, 0.085824, 0.008664, 0, 0,  // R' = (Lr·f+s)·R + Lg·f·G + Lb·f·B
  0.025512, 0.965824, 0.008664, 0, 0,  // G' = Lr·f·R + (Lg·f+s)·G + Lb·f·B
  0.025512, 0.085824, 0.888664, 0, 0,  // B' = Lr·f·R + Lg·f·G + (Lb·f+s)·B
  0,        0,        0,        1, 0,  // A' = A (passthrough)
] as const;

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

// ── Emoji helpers: replace emoji in text with Twemoji PNG <img> tags ──────────
// Twemoji (Twitter's open-source emoji set) is used so that emoji render
// consistently in Lob's HTML renderer regardless of available system fonts.
// Matches full emoji sequences: flag pairs, simple emoji, skin-tone variants,
// and ZWJ sequences (e.g. 👨‍👩‍👧).
const EMOJI_REGEX = /\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:\uFE0F\u20E3?|[\u{1F3FB}-\u{1F3FF}])?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F\u20E3?|[\u{1F3FB}-\u{1F3FF}])?)*/gu;

// CDN sources to try in order when an emoji is not yet cached in Supabase Storage.
// Note: jsdelivr /npm/twemoji@14.0.2 404s — the PNGs aren't in the npm package.
//       Use the /gh/ (GitHub) path instead, which mirrors the full repo assets.
const TWEMOJI_CDN_URLS = [
  (code: string) => `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${code}.png`,
  (code: string) => `https://raw.githubusercontent.com/twitter/twemoji/v14.0.2/assets/72x72/${code}.png`,
  (code: string) => `https://twemoji.maxcdn.com/v/14.0.2/72x72/${code}.png`,
];

function emojiToTwemojiCode(emoji: string): string {
  // Spread by Unicode code points (not UTF-16 code units) so surrogate pairs
  // are handled correctly, then join hex values with dashes.
  return [...emoji]
    .map(c => c.codePointAt(0)!.toString(16))
    .join('-');
}

// Returns the Supabase Storage public URL for a cached Twemoji PNG, uploading
// it from the CDN on first use. Lob CAN fetch Supabase Storage URLs (standard
// HTTPS) but blocks CDN URLs and does not support base64 data URIs.
async function getOrCacheTwemojiUrl(
  supabase: ReturnType<typeof createClient>,
  code: string,
): Promise<string | null> {
  const fileName = `${code}.png`;
  const { data: { publicUrl } } = supabase.storage.from('emoji').getPublicUrl(fileName);

  // Fast path: already cached — skip the CDN fetch
  try {
    const headRes = await fetch(publicUrl, { method: 'HEAD' });
    if (headRes.ok) return publicUrl;
  } catch { /* fall through to upload */ }

  // Slow path: fetch from CDN and cache in Supabase Storage
  for (const makeUrl of TWEMOJI_CDN_URLS) {
    try {
      const res = await fetch(makeUrl(code));
      if (!res.ok) continue;
      const bytes = await res.arrayBuffer();
      const { error } = await supabase.storage
        .from('emoji')
        .upload(fileName, bytes, { contentType: 'image/png', upsert: true });
      if (error) console.error(`[submit-postcard] emoji storage upload failed for ${code}: ${error.message}`);
      return publicUrl; // URL is deterministic regardless of upload success
    } catch (err) {
      console.error(`[submit-postcard] emoji CDN fetch threw for ${code}:`, err);
    }
  }

  console.error(`[submit-postcard] all emoji sources failed for ${code}`);
  return null;
}

// Replaces emoji characters in `text` with <img> tags pointing to Supabase
// Storage URLs. Missing emojis fall back to raw characters (no garbled output
// because Lob skips unrenderable glyphs rather than mojibake-ing them when the
// img tag itself is absent).
async function replaceEmojisWithHtmlImages(
  text: string,
  supabase: ReturnType<typeof createClient>,
): Promise<string> {
  const matches = [...text.matchAll(new RegExp(EMOJI_REGEX.source, 'gu'))];
  if (matches.length === 0) return text;

  const uniqueEmojis = [...new Set(matches.map(m => m[0]))];

  // Resolve all unique emoji URLs in parallel
  const emojiUrls = new Map<string, string | null>();
  await Promise.all(uniqueEmojis.map(async (emoji) => {
    const code = emojiToTwemojiCode(emoji);
    emojiUrls.set(emoji, await getOrCacheTwemojiUrl(supabase, code));
  }));

  return text.replace(EMOJI_REGEX, (emoji) => {
    const url = emojiUrls.get(emoji);
    if (!url) return emoji; // graceful fallback to raw character
    return `<img src="${url}" style="height:1em;width:1em;vertical-align:-0.2em;display:inline-block;margin:0 0.08em" alt="${emoji}">`;
  });
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

async function refundPayment(stripeKey: string, paymentIntentId: string): Promise<{ attempted: boolean; succeeded: boolean }> {
  try {
    const res = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ payment_intent: paymentIntentId, reason: 'requested_by_customer' }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[submit-postcard] Stripe refund failed:', JSON.stringify(data));
      return { attempted: true, succeeded: false };
    }
    console.log('[submit-postcard] Stripe refund issued:', data.id, 'for PI', paymentIntentId);
    return { attempted: true, succeeded: true };
  } catch (err) {
    console.error('[submit-postcard] Stripe refund threw:', err);
    return { attempted: true, succeeded: false };
  }
}

function refundMsg(succeeded: boolean) {
  return succeeded
    ? 'Your payment has been refunded.'
    : 'Please contact support for a refund.';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let tempImagePath: string | null = null;
  let confirmedPaymentIntentId: string | undefined;
  let lobSubmitted = false;
  let stripeKey = STRIPE_SECRET_KEY_LIVE; // refined after parsing testMode

  try {
    const {
      imageBase64, message, location, frame, filter,
      fromAddressId, toAddressId, recipientSnapshot, paymentIntentId, testMode,
    } = await req.json();

    if (!imageBase64 || !paymentIntentId || !fromAddressId || !toAddressId) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    const STRIPE_SECRET_KEY = testMode === true ? STRIPE_SECRET_KEY_TEST : STRIPE_SECRET_KEY_LIVE;
    const LOB_API_KEY = testMode === true ? LOB_API_KEY_TEST : LOB_API_KEY_LIVE;
    stripeKey = STRIPE_SECRET_KEY;

    // ── 1. Verify Stripe payment and extract user identity ────────────────────
    const piRes = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const pi = await piRes.json();
    if (!piRes.ok || pi.status !== 'succeeded' || !pi.metadata?.user_id) {
      return jsonResponse({ error: 'Payment not confirmed' }, 402);
    }
    const userId = pi.metadata.user_id;
    confirmedPaymentIntentId = paymentIntentId;

    // Idempotency: reject if this payment intent was already processed
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle();
    if (existingOrder) {
      return jsonResponse({ error: 'This payment has already been processed' }, 409);
    }

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
        const { succeeded } = await refundPayment(STRIPE_SECRET_KEY, paymentIntentId);
        return jsonResponse({ error: `Content moderation unavailable. ${refundMsg(succeeded)}` }, 503);
      }
      if (isBlocked(safeSearch.adult) || isBlocked(safeSearch.violence)) {
        const { succeeded } = await refundPayment(STRIPE_SECRET_KEY, paymentIntentId);
        return jsonResponse({ error: `This image cannot be sent. ${refundMsg(succeeded)}`, code: 'CONTENT_REJECTED' }, 422);
      }
    } else {
      console.warn('GOOGLE_VISION_API_KEY not set — skipping SafeSearch (dev only)');
    }

    // ── 3. Fetch sender address ───────────────────────────────────────────────
    const { data: fromAddress, error: fromErr } = await supabase
      .from('addresses').select('*')
      .eq('id', fromAddressId).eq('user_id', userId).single();
    if (fromErr || !fromAddress) {
      const { succeeded } = await refundPayment(STRIPE_SECRET_KEY, paymentIntentId);
      return jsonResponse({ error: `Sender address not found. ${refundMsg(succeeded)}` }, 404);
    }

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

      // ── Frame: shrink photo to inner area, place on frame-colored canvas ────
      // The UI shrinks the image to fit inside the frame; we must do the same
      // here so the printed result matches the preview (not crop/cover the photo).
      // Expanding the canvas changes dimensions and causes Lob to reject with 422.
      try {
        const frameDef = FRAMES_DATA.find((f) => f.id === frame);
        if (frameDef && frameDef.borderWidth > 0) {
          const scale = img.width / 327;
          // Lob bleeds 0.125" on each side (37.5px at 300 DPI on a 1875px image).
          // We add that offset so the visible border after bleed matches the CSS preview.
          const BLEED_PX = Math.round(0.125 * (img.width / 6.25)); // ~38px for 1875px images
          const borderPx = Math.round((frameDef.borderWidth + frameDef.padding) * scale) + BLEED_PX;
          const W = img.width, H = img.height;
          const B = Math.min(borderPx, Math.floor(W / 2), Math.floor(H / 2));
          const innerW = W - 2 * B;
          const innerH = H - 2 * B;
          const rawColor = hexToRGBA(frameDef.borderColor === 'transparent' ? '#FFFFFF' : frameDef.borderColor);
          const fr = (rawColor >>> 24) & 0xFF;
          const fg = (rawColor >>> 16) & 0xFF;
          const fb = (rawColor >>> 8)  & 0xFF;
          const fa = rawColor & 0xFF;

          // Shrink the photo to fit exactly within the inner area
          img = img.resize(innerW, innerH) as Image;

          // Create a W×H canvas filled with the frame color
          const framed = new Image(W, H);
          const fbmp = framed.bitmap;
          for (let i = 0; i < fbmp.length; i += 4) {
            fbmp[i] = fr; fbmp[i + 1] = fg; fbmp[i + 2] = fb; fbmp[i + 3] = fa;
          }

          // Blit the resized photo into the frame at offset (B, B), row by row
          const pbmp = img.bitmap;
          for (let py = 0; py < innerH; py++) {
            fbmp.set(
              pbmp.subarray(py * innerW * 4, (py + 1) * innerW * 4),
              (B + py) * W * 4 + B * 4,
            );
          }

          img = framed;
        }
      } catch (stepErr) {
        console.error('[submit-postcard] frame step failed:', stepErr);
      }

      // ── Gamma + saturation: single combined pass ───────────────────────────
      // Replaces two separate full-image passes (gamma LUT + img.saturation()).
      // Gamma (γ=1.3) is applied first, then a linear-RGB saturation matrix
      // (s=0.88) — preserving the original operation order.
      // GAMMA_LUT and SAT_M are module-level constants precomputed once.
      try {
        const bmp = img.bitmap;
        const s = SAT_M;
        for (let i = 0; i < bmp.length; i += 4) {
          const r = GAMMA_LUT[bmp[i]];
          const g = GAMMA_LUT[bmp[i + 1]];
          const b = GAMMA_LUT[bmp[i + 2]];
          bmp[i]     = Math.min(255, Math.max(0, Math.round(s[0]  * r + s[1]  * g + s[2]  * b)));
          bmp[i + 1] = Math.min(255, Math.max(0, Math.round(s[5]  * r + s[6]  * g + s[7]  * b)));
          bmp[i + 2] = Math.min(255, Math.max(0, Math.round(s[10] * r + s[11] * g + s[12] * b)));
          // alpha (i+3) unchanged
        }
      } catch (stepErr) {
        console.error('[submit-postcard] gamma+saturation step failed:', stepErr);
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
      // Twemoji 📍 pin + location text on a dark semi-translucent background.
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

            // Fetch and decode the Twemoji 📍 (Round Pushpin, U+1F4CD) PNG.
            // Uses Supabase Storage cache (same as emoji in message) to avoid
            // CDN URLs that may be inaccessible from the edge function.
            // Falls back to null so the badge still renders without the icon.
            let pinIcon: InstanceType<typeof Image> | null = null;
            try {
              const pinUrl = await getOrCacheTwemojiUrl(supabase, '1f4cd');
              if (pinUrl) {
                const pinRes = await fetch(pinUrl);
                if (pinRes.ok) {
                  const pinBytes = new Uint8Array(await pinRes.arrayBuffer());
                  const decoded = await Image.decode(pinBytes);
                  pinIcon = decoded.resize(iconH, iconH);
                } else {
                  console.error(`[submit-postcard] pin icon fetch ${pinRes.status}: ${pinUrl}`);
                }
              }
            } catch (pinErr) {
              console.error('[submit-postcard] pin icon fetch threw:', pinErr);
            }

            const iconW = pinIcon ? iconH : 0;
            const iconGapActual = pinIcon ? iconGap : 0;

            const badgeH = textImg.height + badgePad * 2;
            const badgeW = badgePad + iconW + iconGapActual + textImg.width + badgePad;

            const badge = new Image(badgeW, badgeH);
            badge.fill(0x000000A6);  // ~65% opacity — matches rgba(0,0,0,0.65) in preview

            // Composite pin icon: vertically centered
            if (pinIcon) {
              const iconY = Math.max(1, Math.round((badgeH - iconH) / 2));
              badge.composite(pinIcon, badgePad, iconY);
            }

            // Composite text: vertically centered
            const textY = Math.max(1, Math.round((badgeH - textImg.height) / 2));
            badge.composite(textImg, badgePad + iconW + iconGapActual, textY);

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
      const { succeeded } = await refundPayment(STRIPE_SECRET_KEY, paymentIntentId);
      return jsonResponse({ error: `Failed to process image. ${refundMsg(succeeded)}` }, 500);
    }

    const { data: { publicUrl: frontUrl } } = supabase.storage
      .from('postcard-fronts')
      .getPublicUrl(tempImagePath);

    // ── 5. Send postcard via Lob ──────────────────────────────────────────────
    const lobCredentials = btoa(`${LOB_API_KEY}:`);
    const normalizedMessage = (message ?? '').trim();
    const htmlEscapedMessage = normalizedMessage.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lobMessage = await replaceEmojisWithHtmlImages(htmlEscapedMessage, supabase);
    const safeLocation = location ? await replaceEmojisWithHtmlImages(String(location).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), supabase) : null;
    const msgLen = normalizedMessage.length;
    const lineCount = htmlEscapedMessage.split('\n').length;
    const LOB_CHARS_PER_LINE = 40;
    const visualLines = htmlEscapedMessage
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
      back: `<html><body style="margin:0;padding:0;font-family:Helvetica,Arial,sans-serif"><table style="width:100%;height:100%;border-collapse:collapse;table-layout:fixed"><tr><td style="width:44%;vertical-align:top;padding:24px 10px 24px 24px"><p style="font-size:${lobFontSize}px;line-height:1.5;color:#333;margin:0;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word">${lobMessage}</p></td><td style="width:56%;vertical-align:top;padding:0"><table style="width:100%;border-collapse:collapse"><tr><td style="text-align:center;padding:28px 14px 20px 14px"><p style="font-size:8px;font-weight:bold;color:#444;margin:0 0 8px 0;letter-spacing:2px;text-transform:uppercase">Snap Send</p><img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&color=222222&bgcolor=ffffff&data=https://snapsend.live" width="80" height="80" style="display:block;margin:0 auto" /><p style="font-size:8px;color:#888;margin:8px 0 0 0;letter-spacing:1px">Send Joy</p></td></tr><tr><td style="padding:0 14px"><hr style="border:none;border-top:1px solid #ddd;margin:0" /></td></tr><tr><td style="padding:10px 14px 4px 14px">${fromHtml}</td></tr><tr><td style="padding:4px 14px 10px 14px">${toHtml}</td></tr></table></td></tr></table></body></html>`,
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
      const { succeeded } = await refundPayment(STRIPE_SECRET_KEY, paymentIntentId);
      return jsonResponse({ error: `Lob ${lobRes.status}: ${lobErrMsg} ${refundMsg(succeeded)}`, lob_status: lobRes.status, lob_detail: lobData }, 502);
    }

    lobSubmitted = true;

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
    if (confirmedPaymentIntentId && !lobSubmitted) {
      await refundPayment(stripeKey, confirmedPaymentIntentId);
    }
    console.error('Unhandled error:', err);
    return jsonResponse({ error: 'Internal server error', detail: String(err) }, 500);
  }
});
