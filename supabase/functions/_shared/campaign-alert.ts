// Alerts support by email when a user who installed from the postcard QR code makes a purchase.

const SUPPORT_EMAIL = 'support@snapsend.live';

export async function alertPostcardCampaignPurchase(
  supabase: any,
  paymentIntent: any,
): Promise<void> {
  const userId = paymentIntent.metadata?.user_id;
  if (!userId || !paymentIntent.livemode) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, install_campaign, install_campaign_at')
    .eq('id', userId)
    .maybeSingle();
  if (profile?.install_campaign !== 'postcard') return;

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return;

  const amount = `$${((paymentIntent.amount_received ?? paymentIntent.amount) / 100).toFixed(2)}`;
  const text = [
    'A user who installed Snap Send from a postcard QR code just made a purchase.',
    '',
    `Name: ${profile.full_name ?? 'unknown'}`,
    `Amount: ${amount}`,
    `Installed via postcard: ${profile.install_campaign_at ?? 'unknown'}`,
    `PaymentIntent: ${paymentIntent.id}`,
  ].join('\n');

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `qr-purchase-${paymentIntent.id}`,
    },
    body: JSON.stringify({
      from: `Snap Send Alerts <${SUPPORT_EMAIL}>`,
      to: [SUPPORT_EMAIL],
      subject: `Postcard QR user bought a postcard (${amount})`,
      text,
    }),
  });
}
