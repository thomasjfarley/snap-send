// Prints a request once the recipient's address is saved, and tells the sender.
// Shared by the public address-request function and the daily process-address-requests job.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { addressReceivedEmail, sendEmail } from './request-emails.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export async function printRequest(
  supabase: ReturnType<typeof createClient>,
  requestId: string,
): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-postcard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ addressRequestId: requestId, mode: 'print' }),
  });
  const result = await res.json().catch(() => ({}));

  if (!res.ok || !result.success) {
    console.error('[print-request] print failed:', res.status, JSON.stringify(result).slice(0, 500));
    const { data: current } = await supabase
      .from('address_requests').select('print_attempts').eq('id', requestId).single();
    await supabase
      .from('address_requests')
      .update({ print_attempts: (current?.print_attempts ?? 0) + 1 })
      .eq('id', requestId);
    return false;
  }

  await supabase
    .from('address_requests')
    .update({
      status: 'fulfilled',
      postcard_id: result.postcardId ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  // The print copy is no longer needed once Lob has it.
  await supabase.storage.from('address-request-images').remove([`${requestId}/original.jpg`]);

  const { data: row } = await supabase
  const { data: row } = await supabase
    .from('address_requests')
    .select('user_id, to_address_id')
    .eq('id', requestId)
    .single();
  if (row) {
    const [{ data: sender }, { data: authUser }, { data: toAddress }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', row.user_id).maybeSingle(),
      supabase.auth.admin.getUserById(row.user_id),
      supabase.from('addresses').select('full_name').eq('id', row.to_address_id).maybeSingle(),
    ]);
    const to = authUser?.user?.email;
    if (to) {
      await sendEmail({
        to,
        email: addressReceivedEmail({
          senderFirstName: (sender?.full_name ?? '').trim().split(/\s+/)[0] || null,
          recipientName: toAddress?.full_name ?? 'Your recipient',
        }),
        idempotencyKey: `request-address-received-${requestId}`,
        tag: 'request-address-received',
      });
    }
  }
  return true;
}
