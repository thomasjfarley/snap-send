// Edge Function: qr-scan  (PUBLIC; deploy with --no-verify-jwt)
// Called by https://snapsend.live/q when someone scans the QR code on a postcard.
// Logs the scan; the web page then redirects to the right store.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const platform = ['ios', 'android', 'other'].includes(body?.platform) ? body.platform : 'other';
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await supabase.from('qr_scans').insert({
      campaign: 'postcard',
      platform,
      user_agent: (req.headers.get('user-agent') ?? '').slice(0, 300),
    });
  } catch {
    // Never block the redirect on logging
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
