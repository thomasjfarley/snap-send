// Edge Function: process-address-requests  (called daily by pg_cron)
//  - retries printing for requests whose address arrived but Lob failed (then refunds after 3 tries)
//  - sends recipient reminders + sender nudges at 7, 15 and 30 days while no address has been entered
//  - at 45 days: refunds the sender if the card was neither downloaded nor given an address;
//    if it was downloaded, the digital delivery stands (no refund) and the sender is told
//  - deletes stored images once a request has expired

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { refundPaymentIntent } from '../_shared/refund.ts';
import { printRequest } from '../_shared/address-request-print.ts';
import {
  expiredDigitalEmail,
  recipientReminderEmail,
  senderNudgeEmail,
  sendEmail,
} from '../_shared/request-emails.ts';

const STRIPE_SECRET_KEY_LIVE = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_SECRET_KEY_TEST = Deno.env.get('STRIPE_SECRET_KEY_TEST')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const DAY_MS = 86_400_000;
const REMINDER_DAYS = [7, 15, 30];
const MAX_PRINT_ATTEMPTS = 3;
const BUCKET = 'address-request-images';

function reportError(title: string, severity: 'warning' | 'error' | 'critical', details: string) {
  fetch(`${SUPABASE_URL}/functions/v1/report-error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ source: 'process-address-requests', title, severity, details }),
  }).catch(() => {});
}

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = Date.now();
  const summary = { printed: 0, refunded: 0, reminded: 0, expiredDigital: 0, cleaned: 0, errors: 0 };

  const senderInfo = async (userId: string) => {
    const [{ data: profile }, { data: authUser }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
      supabase.auth.admin.getUserById(userId),
    ]);
    const fullName = (profile?.full_name ?? '') as string;
    return {
      fullName: fullName || null,
      firstName: fullName.trim().split(/\s+/)[0] || null,
      email: authUser?.user?.email ?? null,
    };
  };

  const refund = (row: { stripe_payment_intent_id: string; user_id: string; test_mode: boolean }, reason: 'failed' | 'unclaimed') =>
    refundPaymentIntent(
      row.test_mode ? STRIPE_SECRET_KEY_TEST : STRIPE_SECRET_KEY_LIVE,
      row.stripe_payment_intent_id,
      row.user_id,
      reason,
    );

  try {
    // ── 1. Retry prints that failed after the address arrived ─────────────────
    const { data: stuck } = await supabase
      .from('address_requests')
      .select('*')
      .eq('status', 'processing')
      .not('to_address_id', 'is', null);
    for (const row of stuck ?? []) {
      try {
        if (row.print_attempts >= MAX_PRINT_ATTEMPTS) {
          if (await refund(row, 'failed')) {
            await supabase
              .from('address_requests')
              .update({ status: 'refunded', resolved_at: new Date().toISOString() })
              .eq('id', row.id);
            summary.refunded++;
            reportError('Address request refunded after print failures', 'warning', `requestId=${row.id}`);
          }
        } else if (await printRequest(supabase, row.id)) {
          summary.printed++;
        }
      } catch (err) {
        summary.errors++;
        console.error('[process-address-requests] print retry failed', row.id, err);
      }
    }

    // ── 2. Reminders while waiting for an address ─────────────────────────────
    const { data: waiting } = await supabase
      .from('address_requests')
      .select('*')
      .eq('status', 'awaiting_address')
      .gt('expires_at', new Date(now).toISOString());
    for (const row of waiting ?? []) {
      try {
        const ageDays = (now - new Date(row.created_at).getTime()) / DAY_MS;
        const due = REMINDER_DAYS.filter((d) => ageDays >= d).length;
        if (row.reminders_sent >= due) continue;

        // Optimistic claim so overlapping runs can't double send.
        const { data: claimed } = await supabase
          .from('address_requests')
          .update({ reminders_sent: due, last_reminder_at: new Date(now).toISOString() })
          .eq('id', row.id)
          .eq('reminders_sent', row.reminders_sent)
          .select('id')
          .maybeSingle();
        if (!claimed) continue;

        const sender = await senderInfo(row.user_id);
        const daysLeft = Math.max(1, Math.ceil((new Date(row.expires_at).getTime() - now) / DAY_MS));
        await sendEmail({
          to: row.recipient_email,
          email: recipientReminderEmail({ senderName: sender.fullName, token: row.token, daysLeft }),
          idempotencyKey: `request-reminder-${row.id}-${due}`,
          tag: 'request-reminder',
        });
        if (sender.email) {
          await sendEmail({
            to: sender.email,
            email: senderNudgeEmail({ senderFirstName: sender.firstName, recipientEmail: row.recipient_email }),
            idempotencyKey: `request-nudge-${row.id}-${due}`,
            tag: 'request-nudge',
          });
        }
        summary.reminded++;
      } catch (err) {
        summary.errors++;
        console.error('[process-address-requests] reminder failed', row.id, err);
      }
    }

    // ── 3. Day 45: refund or complete digitally ───────────────────────────────
    const { data: expiring } = await supabase
      .from('address_requests')
      .select('*')
      .eq('status', 'awaiting_address')
      .lte('expires_at', new Date(now).toISOString());
    for (const row of expiring ?? []) {
      try {
        if (!row.downloaded_at) {
          if (await refund(row, 'unclaimed')) {
            await supabase
              .from('address_requests')
              .update({ status: 'refunded', resolved_at: new Date().toISOString() })
              .eq('id', row.id)
              .eq('status', 'awaiting_address');
            summary.refunded++;
          } else {
            summary.errors++;
            reportError('Day-45 refund failed', 'error', `requestId=${row.id}; paymentIntentId=${row.stripe_payment_intent_id}`);
          }
        } else {
          const { data: claimed } = await supabase
            .from('address_requests')
            .update({ status: 'expired_digital', resolved_at: new Date().toISOString() })
            .eq('id', row.id)
            .eq('status', 'awaiting_address')
            .select('id')
            .maybeSingle();
          if (claimed) {
            const sender = await senderInfo(row.user_id);
            if (sender.email) {
              await sendEmail({
                to: sender.email,
                email: expiredDigitalEmail({ senderFirstName: sender.firstName, recipientEmail: row.recipient_email }),
                idempotencyKey: `request-expired-digital-${row.id}`,
                tag: 'request-expired-digital',
              });
            }
            summary.expiredDigital++;
          }
        }
      } catch (err) {
        summary.errors++;
        console.error('[process-address-requests] expiry failed', row.id, err);
      }
    }

    // ── 4. Delete images for resolved, expired requests ───────────────────────
    const { data: toClean } = await supabase
      .from('address_requests')
      .select('id')
      .in('status', ['fulfilled', 'refunded', 'expired_digital'])
      .lte('expires_at', new Date(now).toISOString())
      .is('images_deleted_at', null)
      .limit(200);
    for (const row of toClean ?? []) {
      await supabase.storage.from(BUCKET).remove([`${row.id}/original.jpg`, `${row.id}/front.jpg`]);
      await supabase
        .from('address_requests')
        .update({ images_deleted_at: new Date().toISOString() })
        .eq('id', row.id);
      summary.cleaned++;
    }
  } catch (err) {
    reportError(
      'Unhandled process-address-requests error',
      'critical',
      err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    );
    return new Response(JSON.stringify({ error: 'failed', summary }), { status: 500 });
  }

  if (summary.errors > 0) {
    reportError('process-address-requests finished with errors', 'warning', JSON.stringify(summary));
  }
  return new Response(JSON.stringify({ ok: true, summary }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
