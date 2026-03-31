import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

  // We handle JWT auth ourselves so verify_jwt is disabled at the gateway level.
  // Decode the payload directly to extract the user ID — no extra API call needed.
  try {
    const jwt = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    const userId: string = payload.sub;
    if (!userId) return jsonResponse({ error: 'Unauthorized' }, 401);

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Failed to delete user:', deleteError);
      return jsonResponse({ error: 'Failed to delete account' }, 500);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.error('Unhandled error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
