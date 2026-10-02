import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const LOB_API_KEY_LIVE = Deno.env.get('LOB_API_KEY')!;
const LOB_API_KEY_TEST = Deno.env.get('LOB_API_KEY_TEST')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PostcardStatus =
  | 'submitted'
  | 'in_transit'
  | 'processed_for_delivery'
  | 'delivered'
  | 'failed';

const STATUS_RANK: Record<string, number> = {
  pending: 0,
  paid: 0,
  submitted: 1,
  mailed: 2,
  in_transit: 2,
  processed_for_delivery: 3,
  delivered: 4,
  failed: 5,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function mapLobStatus(postcard: {
  status?: string;
  tracking_events?: Array<{ name?: string; time?: string }> | null;
}): PostcardStatus {
  if (postcard.status === 'failed') return 'failed';

  const eventNames = new Set((postcard.tracking_events ?? []).map((event) => event.name));
  if (eventNames.has('Delivered')) return 'delivered';
  if (eventNames.has('Processed for Delivery')) return 'processed_for_delivery';
  if (eventNames.has('Returned to Sender')) return 'failed';
  if (
    eventNames.has('Mailed') ||
    eventNames.has('In Transit') ||
    eventNames.has('In Local Area') ||
    eventNames.has('Re-Routed') ||
    eventNames.has('International Exit')
  ) {
    return 'in_transit';
  }

  return 'submitted';
}

async function retrievePostcard(lobId: string) {
  for (const apiKey of [LOB_API_KEY_LIVE, LOB_API_KEY_TEST]) {
    if (!apiKey) continue;
    const response = await fetch(`https://api.lob.com/v1/postcards/${encodeURIComponent(lobId)}`, {
      headers: { Authorization: `Basic ${btoa(`${apiKey}:`)}` },
    });
    const data = await response.json();
    if (response.ok) return data;
    if (response.status !== 404) {
      throw new Error(`Lob ${response.status}: ${JSON.stringify(data).slice(0, 500)}`);
    }
  }
  throw new Error(`Lob postcard ${lobId} was not found`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { postcardId } = await req.json().catch(() => ({}));
    let query = supabase
      .from('postcards')
      .select('id, lob_id, status, mailed_at, delivered_at')
      .eq('user_id', user.id)
      .not('lob_id', 'is', null);
    if (postcardId) query = query.eq('id', postcardId);

    const { data: postcards, error: queryError } = await query;
    if (queryError) return jsonResponse({ error: queryError.message }, 500);

    const results = await Promise.allSettled(
      (postcards ?? []).map(async (postcard) => {
        const lobPostcard = await retrievePostcard(postcard.lob_id!);
        const fetchedStatus = mapLobStatus(lobPostcard);
        const currentStatus = postcard.status === 'mailed' ? 'in_transit' : postcard.status;
        const status =
          STATUS_RANK[fetchedStatus] >= STATUS_RANK[currentStatus]
            ? fetchedStatus
            : currentStatus as PostcardStatus;
        const update: Record<string, string> = { status };
        if (
          ['in_transit', 'processed_for_delivery', 'delivered'].includes(status) &&
          !postcard.mailed_at
        ) {
          update.mailed_at = new Date().toISOString();
        }
        if (status === 'delivered' && !postcard.delivered_at) {
          update.delivered_at = new Date().toISOString();
        }

        const { error } = await supabase
          .from('postcards')
          .update(update)
          .eq('id', postcard.id)
          .eq('user_id', user.id);
        if (error) throw error;
        return { id: postcard.id, status };
      }),
    );

    const synced = results
      .filter((result): result is PromiseFulfilledResult<{ id: string; status: PostcardStatus }> =>
        result.status === 'fulfilled')
      .map((result) => result.value);
    const failed = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => String(result.reason));

    if (synced.length === 0 && failed.length > 0) {
      return jsonResponse({ error: 'Could not refresh Lob statuses', failed }, 502);
    }
    return jsonResponse({ synced, failed });
  } catch (error) {
    console.error('[sync-lob-status] failed:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
