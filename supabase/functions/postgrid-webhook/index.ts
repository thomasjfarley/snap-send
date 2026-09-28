import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jwtVerify } from 'npm:jose@5';
import { mapPostGridStatus } from '../_shared/postgrid.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const POSTGRID_WEBHOOK_SECRET = Deno.env.get('POSTGRID_WEBHOOK_SECRET')!;

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!POSTGRID_WEBHOOK_SECRET) return new Response('Webhook not configured', { status: 503 });

  try {
    const token = await req.text();
    const secret = new TextEncoder().encode(POSTGRID_WEBHOOK_SECRET);
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    const event = payload as {
      type?: string;
      data?: { id?: string; status?: string; live?: boolean; url?: string | null };
    };

    if (!event.type?.startsWith('postcard.') || !event.data?.id || !event.data.status) {
      return new Response('ok', { status: 200 });
    }

    const status = mapPostGridStatus(event.data.status);
    const update: Record<string, unknown> = {
      status,
      provider_status: event.data.status,
      provider_live: event.data.live ?? null,
    };
    if (event.data.url) update.provider_preview_url = event.data.url;
    if (status === 'mailed') update.mailed_at = new Date().toISOString();
    if (status === 'delivered') update.delivered_at = new Date().toISOString();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await supabase
      .from('postcards')
      .update(update)
      .eq('fulfillment_provider', 'postgrid')
      .eq('provider_id', event.data.id);

    if (error) {
      console.error('[postgrid-webhook] update failed:', error);
      return new Response('Database error', { status: 500 });
    }
    return new Response('ok', { status: 200 });
  } catch (error) {
    console.error('[postgrid-webhook] invalid webhook:', error);
    return new Response('Unauthorized', { status: 401 });
  }
});

