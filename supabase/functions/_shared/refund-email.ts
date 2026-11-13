// Shared refund confirmation email (Resend). Used by submit-postcard, request-refund and postcard-webhook.
// Deliverability: sent from the verified snapsend.live domain (SPF/DKIM/DMARC pass), with a plain-text
// part, no tracking pixels or link wrappers, no images, and a real reply-to address.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPPORT_EMAIL = 'support@snapsend.live';
const FROM = `Snap Send <${SUPPORT_EMAIL}>`;
const BRAND = '#2563EB';

export type RefundReason = 'failed' | 'cancelled' | 'unclaimed';

export interface RefundEmailOptions {
  userId: string;
  paymentIntentId: string;
  amountCents?: number | null;
  currency?: string | null;
  reason?: RefundReason;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatAmount(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function buildRefundEmail(opts: {
  firstName: string | null;
  amount: string | null;
  orderRef: string;
  reason: RefundReason;
}): { subject: string; html: string; text: string } {
  const { firstName, amount, orderRef, reason } = opts;
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
  const headline = 'Your refund is on its way';
  const intro = reason === 'cancelled'
    ? "As requested, we've cancelled your postcard order and refunded your payment in full."
    : reason === 'unclaimed'
    ? "Your recipient didn't enter their address or download the postcard within 45 days, so we've refunded your payment in full."
    : "We're sorry, we couldn't print and mail your postcard, so we've refunded your payment in full.";
  const timing = 'The refund goes back to your original payment method and usually appears within 5 to 10 business days, depending on your bank.';
  const retry = "You're welcome to try sending your postcard again anytime. If something still doesn't look right, reply to this email and a real person will help.";
  const preheader = amount
    ? `We've refunded ${amount} to your original payment method.`
    : "We've refunded your payment to your original payment method.";

  const text = [
    greeting,
    '',
    intro,
    '',
    ...(amount ? [`Refund amount: ${amount}`] : []),
    `Order reference: ${orderRef}`,
    '',
    timing,
    '',
    retry,
    '',
    'Thank you,',
    'The Snap Send team',
    '',
    `Questions? Reply to this email or contact ${SUPPORT_EMAIL}.`,
    'Snap Send - https://snapsend.live',
  ].join('\n');

  const row = (label: string, value: string) => `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;font-size:14px;color:#64748B;">${label}</td>
                <td align="right" style="padding:10px 0;border-bottom:1px solid #E2E8F0;font-size:14px;color:#0F172A;font-weight:600;">${value}</td>
              </tr>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${headline}</title>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F1F5F9;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
        <tr>
          <td style="background-color:${BRAND};padding:24px 32px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:0.2px;">
            Snap Send
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#0F172A;">
            <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0F172A;">${headline}</h1>
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">${esc(greeting)}</p>
            <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">${intro}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border-top:1px solid #E2E8F0;">${amount ? row('Refund amount', esc(amount)) : ''}${row('Order reference', esc(orderRef))}${row('Refunded to', 'Original payment method')}
            </table>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${timing}</p>
            <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">${retry}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background-color:#F8FAFC;border-top:1px solid #E2E8F0;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#64748B;">
            Questions? Reply to this email or contact <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND};text-decoration:none;">${SUPPORT_EMAIL}</a>.<br>
            You're receiving this because a refund was issued for your Snap Send order.<br>
            Snap Send &middot; <a href="https://snapsend.live" style="color:#64748B;">snapsend.live</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject: 'Your Snap Send refund is on its way', html, text };
}

// Never throws: a failed email must not break the refund flow.
export async function sendRefundEmail(opts: RefundEmailOptions): Promise<void> {
  try {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      console.error('[refund-email] RESEND_API_KEY not set');
      return;
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data, error } = await supabase.auth.admin.getUserById(opts.userId);
    const to = data?.user?.email;
    if (error || !to) {
      console.error('[refund-email] no email for user', opts.userId, error?.message);
      return;
    }
    const fullName = (data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? '') as string;
    const firstName = fullName.trim().split(/\s+/)[0] || null;
    const amount = typeof opts.amountCents === 'number' && opts.amountCents > 0
      ? formatAmount(opts.amountCents, opts.currency ?? 'usd')
      : null;
    const orderRef = opts.paymentIntentId.replace(/^pi_/, '').slice(-10).toUpperCase();
    const { subject, html, text } = buildRefundEmail({
      firstName,
      amount,
      orderRef,
      reason: opts.reason ?? 'failed',
    });

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // One email per refunded payment even if two code paths race.
        'Idempotency-Key': `refund-email-${opts.paymentIntentId}`,
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        reply_to: SUPPORT_EMAIL,
        subject,
        html,
        text,
        headers: { 'X-Entity-Ref-ID': `refund-${opts.paymentIntentId}` },
        tags: [{ name: 'type', value: 'refund' }],
      }),
    });
    if (!res.ok) {
      console.error('[refund-email] Resend failed:', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('[refund-email] threw:', err);
  }
}
