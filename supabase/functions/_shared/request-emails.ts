// Emails for the "request an address" flow (Resend). Same deliverability approach as refund-email.ts:
// verified snapsend.live sender, plain-text part, no tracking pixels or link wrappers, real reply-to.
export const SUPPORT_EMAIL = 'support@snapsend.live';
const FROM = `Snap Send <${SUPPORT_EMAIL}>`;
const BRAND = '#2563EB';
const FONT = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";

export const REQUEST_LINK_BASE = 'https://snapsend.live/r/';
export const REQUEST_WINDOW_DAYS = 45;

export function requestLink(token: string): string {
  return `${REQUEST_LINK_BASE}${token}`;
}

// Token-gated image endpoint (GET on the public address-request function), so the images keep
// working in an email client for as long as the link itself is active.
export function cardImageUrl(token: string, side: 'front' | 'back'): string {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/address-request?t=${encodeURIComponent(token)}&side=${side}`;
}

export async function hasBackImage(
  supabase: { storage: { from: (b: string) => { list: (p: string, o?: unknown) => Promise<{ data: { name: string }[] | null }> } } },
  requestId: string,
): Promise<boolean> {
  const { data } = await supabase.storage.from('address-request-images').list(requestId, { search: 'back.jpg' });
  return !!data?.some((f) => f.name === 'back.jpg');
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface EmailContent {
  subject: string;
  headline: string;
  preheader: string;
  paragraphs: string[];
  images?: string[];
  cta?: { label: string; url: string };
  footerNote: string;
}

function render(c: EmailContent): { subject: string; html: string; text: string } {
  const text = [
    ...c.paragraphs.flatMap((p) => [p, '']),
    ...(c.cta ? [`${c.cta.label}: ${c.cta.url}`, ''] : []),
    'With warmth,',
    'The Snap Send team',
    '',
    `Questions? Reply to this email or contact ${SUPPORT_EMAIL}.`,
    'Snap Send - https://snapsend.live',
  ].join('\n');

  const paragraphsHtml = c.paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;">${esc(p)}</p>`)
    .join('\n            ');
  const imagesHtml = (c.images ?? [])
    .map((src, i) => `<img src="${esc(src)}" alt="${i === 0 ? 'Front of your postcard' : 'Back of your postcard'}" width="496" style="display:block;width:100%;max-width:496px;height:auto;margin:0 0 12px;border-radius:6px;border:1px solid #E2E8F0;">`)
    .join('\n            ');
  const ctaHtml = c.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr><td style="background-color:${BRAND};border-radius:8px;"><a href="${esc(c.cta.url)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;">${esc(c.cta.label)}</a></td></tr></table>
            <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#64748B;">If the button doesn't work, copy this link into your browser:<br><span style="word-break:break-all;">${esc(c.cta.url)}</span></p>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(c.headline)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(c.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F1F5F9;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
        <tr>
          <td style="background-color:${BRAND};padding:24px 32px;font-family:${FONT};font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:0.2px;">
            Snap Send
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font-family:${FONT};color:#0F172A;">
            <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0F172A;">${esc(c.headline)}</h1>
            ${paragraphsHtml}
            ${imagesHtml}
            ${ctaHtml}
            <p style="margin:0;font-size:16px;line-height:1.6;">With warmth,<br>The Snap Send team</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background-color:#F8FAFC;border-top:1px solid #E2E8F0;font-family:${FONT};font-size:13px;line-height:1.6;color:#64748B;">
            Questions? Reply to this email or contact <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND};text-decoration:none;">${SUPPORT_EMAIL}</a>.<br>
            ${esc(c.footerNote)}<br>
            Snap Send &middot; <a href="https://snapsend.live" style="color:#64748B;">snapsend.live</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject: c.subject, html, text };
}

// Header values must not contain line breaks; the name is user-controlled.
function safeName(name: string | null | undefined, fallback: string): string {
  const cleaned = (name ?? '').replace(/[\r\n<>"]+/g, ' ').trim().slice(0, 80);
  return cleaned || fallback;
}

const RECIPIENT_FOOTER = "You're receiving this because someone sent you a postcard with Snap Send.";
const SENDER_FOOTER = "You're receiving this because you sent a postcard with Snap Send.";

export function inviteEmail(opts: { senderName: string | null; token: string; hasBack?: boolean }) {
  const sender = safeName(opts.senderName, 'Someone who cares about you');
  return render({
    subject: `${sender} is sending you a postcard`,
    headline: `${sender} is sending you a postcard`,
    preheader: 'Open it to see your postcard and tell us where to send it.',
    paragraphs: [
      'Hello,',
      `${sender} just made you a postcard and wants to mail it to you. We're getting it ready to be printed and delivered.`,
      "You can see your postcard right now, and download it if you'd like. Share the address where it should be mailed and we'll send the real thing straight to your mailbox.",
    ],
    cta: { label: 'See your postcard', url: requestLink(opts.token) },
    footerNote: RECIPIENT_FOOTER,
  });
}

export function recipientReminderEmail(opts: { senderName: string | null; token: string; daysLeft: number; hasBack?: boolean }) {
  const sender = safeName(opts.senderName, 'Someone who cares about you');
  return render({
    subject: `A reminder: ${sender}'s postcard is waiting for you`,
    headline: 'Your postcard is still waiting',
    preheader: `${sender} is still hoping to mail you a postcard.`,
    paragraphs: [
      'Hello again,',
      `${sender} sent you a postcard, and we haven't received an address to mail it to yet. It's not too late: add your address and we'll print and mail it to you.`,
      `This link stays active for ${opts.daysLeft} more days.`,
    ],
    cta: { label: 'See your postcard', url: requestLink(opts.token) },
    footerNote: RECIPIENT_FOOTER,
  });
}

export function senderNudgeEmail(opts: { senderFirstName: string | null; recipientEmail: string }) {
  const greeting = opts.senderFirstName ? `Hi ${safeName(opts.senderFirstName, '')},` : 'Hi there,';
  return render({
    subject: "Your postcard is still waiting for an address",
    headline: 'A gentle nudge might help',
    preheader: `${opts.recipientEmail} hasn't entered an address yet.`,
    paragraphs: [
      greeting,
      `We've emailed your postcard link to ${opts.recipientEmail}, but they haven't entered a mailing address yet. We've sent them a friendly reminder.`,
      "It may help to give them a quick nudge, and to ask them to check their spam or promotions folder in case the email landed there.",
      "As soon as they add their address, we'll print and mail your postcard.",
    ],
    footerNote: SENDER_FOOTER,
  });
}

export function addressReceivedEmail(opts: { senderFirstName: string | null; recipientName: string }) {
  const greeting = opts.senderFirstName ? `Hi ${safeName(opts.senderFirstName, '')},` : 'Hi there,';
  const recipient = safeName(opts.recipientName, 'Your recipient');
  return render({
    subject: 'Your postcard is on its way to print',
    headline: `${recipient} shared their address`,
    preheader: 'Your postcard is being printed and mailed.',
    paragraphs: [
      greeting,
      `Good news: ${recipient} shared their mailing address, so your postcard is being printed and will be mailed to them.`,
      "We've also saved their address to your address book, so next time you can send them a postcard in just a couple of taps.",
    ],
    footerNote: SENDER_FOOTER,
  });
}

export function expiredDigitalEmail(opts: { senderFirstName: string | null; recipientEmail: string }) {
  const greeting = opts.senderFirstName ? `Hi ${safeName(opts.senderFirstName, '')},` : 'Hi there,';
  return render({
    subject: 'Your postcard was delivered digitally',
    headline: 'Your postcard was delivered digitally',
    preheader: `${opts.recipientEmail} downloaded your postcard.`,
    paragraphs: [
      greeting,
      `${opts.recipientEmail} downloaded your postcard but didn't share a mailing address within ${REQUEST_WINDOW_DAYS} days, so we haven't printed a physical copy.`,
      'Because the digital version was delivered, this order is complete and is not refunded. If something looks wrong, just reply to this email and we will help.',
    ],
    footerNote: SENDER_FOOTER,
  });
}

// Never throws: email trouble must not break the request flow. Returns whether Resend accepted it.
export async function sendEmail(opts: {
  to: string;
  email: { subject: string; html: string; text: string };
  idempotencyKey: string;
  tag: string;
}): Promise<boolean> {
  try {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      console.error('[request-emails] RESEND_API_KEY not set');
      return false;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': opts.idempotencyKey,
      },
      body: JSON.stringify({
        from: FROM,
        to: [opts.to],
        reply_to: SUPPORT_EMAIL,
        subject: opts.email.subject,
        html: opts.email.html,
        text: opts.email.text,
        tags: [{ name: 'type', value: opts.tag }],
      }),
    });
    if (!res.ok) {
      console.error('[request-emails] Resend failed:', res.status, await res.text().catch(() => ''));
    }
    return res.ok;
  } catch (err) {
    console.error('[request-emails] threw:', err);
    return false;
  }
}
