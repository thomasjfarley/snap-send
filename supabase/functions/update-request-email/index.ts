// Edge Function: update-request-email
// Lets a sender fix the recipient email of an address request that nobody has viewed yet.
// The link token is rotated so the old (wrong) address can no longer open the card, then the
// invite is re-sent to the new address.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { inviteEmail, sendEmail } from '../_shared/request-emails.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_REGEX = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const { requestId, email: rawEmail } = await req.json();
    const email = String(rawEmail ?? '').trim().toLowerCase();
    if (!requestId || !EMAIL_REGEX.test(email) || email.length > 254) {
      return json({ error: 'Please enter a valid email address.' }, 400);
    }

    const { data: row } = await supabase
      .from('address_requests')
      .select('id, token, recipient_email, recipient_name, sender_name, status, downloaded_at, expires_at')
      .eq('id', requestId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!row) return json({ error: 'Request not found.' }, 404);
    if (row.status !== 'awaiting_address' || new Date(row.expires_at).getTime() <= Date.now()) {
      return json({ error: 'This request can no longer be changed.' }, 409);
    }
    if (row.downloaded_at) {
      return json({ error: 'Your recipient has already opened this postcard, so the email can no longer be changed.' }, 409);
    }
    if (row.recipient_email.toLowerCase() === email) {
      return json({ error: "That's the email this postcard was already sent to." }, 400);
    }

    const token = newToken();
    const { data: updated } = await supabase
      .from('address_requests')
      .update({ recipient_email: email, token })
      .eq('id', row.id)
      .eq('status', 'awaiting_address')
      .is('downloaded_at', null)
      .select('id')
      .maybeSingle();
    if (!updated) return json({ error: 'This request can no longer be changed.' }, 409);

    const { data: profile } = await supabase
      .from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    const sent = await sendEmail({
      to: email,
      email: inviteEmail({
        senderName: row.sender_name || profile?.full_name || null,
        recipientName: row.recipient_name ?? null,
        token,
      }),
      idempotencyKey: `request-invite-${row.id}-${token.slice(0, 12)}`,
      tag: 'request-invite',
    });
    if (!sent) {
      await supabase.from('address_requests').update({ recipient_email: row.recipient_email, token: row.token }).eq('id', row.id);
      return json({ error: "We couldn't send the email. Please try again." }, 502);
    }

    return json({ success: true, email });
  } catch (err) {
    console.error('[update-request-email]', err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
