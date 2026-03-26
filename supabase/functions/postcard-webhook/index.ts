// Edge Function: postcard-webhook
// Receives Lob.com webhook events and updates postcard status in the DB.
// Register this URL in your Lob dashboard: Settings → Webhooks

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOB_WEBHOOK_SECRET = Deno.env.get('LOB_WEBHOOK_SECRET')!;

// Lob event → postcard status mapping
const EVENT_STATUS_MAP: Record<string, 'submitted' | 'mailed' | 'failed'> = {
  'postcard.created': 'submitted',
  'postcard.rendered_pdf': 'submitted',
  'postcard.rendered_thumbnails': 'submitted',
  'postcard.mailed': 'mailed',
  'postcard.in_transit': 'mailed',
  'postcard.in_local_area': 'mailed',
  'postcard.failed': 'failed',
};

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

    const { error } = await supabase
      .from('postcards')
      .update(updateData)
      .eq('lob_id', lobId);

    if (error) {
      console.error('Failed to update postcard status:', error);
      return new Response('DB error', { status: 500 });
    }

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('Internal server error', { status: 500 });
  }
});
