// Edge Function: check-image-safety
// Runs Google Vision SafeSearch on the provided image before payment is initiated.
// Keeping this as a separate function lets the client gate payment on content safety
// without going through the full submit flow.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_VISION_API_KEY = Deno.env.get('GOOGLE_VISION_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { imageBase64 } = await req.json();
    if (!imageBase64) return jsonResponse({ error: 'Missing imageBase64' }, 400);

    if (!GOOGLE_VISION_API_KEY) {
      console.warn('GOOGLE_VISION_API_KEY not set — skipping SafeSearch (dev only)');
      return jsonResponse({ safe: true });
    }

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

    // LEGAL REQUIREMENT — 18 U.S.C. § 1461
    if (isBlocked(safeSearch.adult) || isBlocked(safeSearch.violence)) {
      return jsonResponse({ safe: false, code: 'CONTENT_REJECTED' }, 422);
    }

    return jsonResponse({ safe: true });

  } catch (err) {
    console.error('Unhandled error:', err);
    return jsonResponse({ error: 'Internal server error', detail: String(err) }, 500);
  }
});
