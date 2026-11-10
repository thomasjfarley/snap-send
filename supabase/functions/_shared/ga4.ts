// Reports a server-verified Stripe purchase to GA4 via the Measurement Protocol.
// Only runs when the client supplied an app instance ID (i.e. analytics was allowed).
// Env (set per platform, from GA4 Admin → Data streams → Measurement Protocol API secrets):
//   GA4_ANDROID_APP_ID, GA4_ANDROID_API_SECRET, GA4_IOS_APP_ID, GA4_IOS_API_SECRET

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export async function sendGa4Purchase(
  supabase: SupabaseClient,
  paymentIntent: Record<string, any>,
  eventCreatedSeconds: number,
): Promise<'sent' | 'skipped' | 'already_sent'> {
  const md = paymentIntent.metadata ?? {};
  const appInstanceId = md.ga_app_instance_id;
  const platform = md.ga_platform;
  if (!appInstanceId || (platform !== 'ios' && platform !== 'android')) return 'skipped';

  const prefix = platform === 'ios' ? 'GA4_IOS' : 'GA4_ANDROID';
  const appId = Deno.env.get(`${prefix}_APP_ID`);
  const apiSecret = Deno.env.get(`${prefix}_API_SECRET`);
  if (!appId || !apiSecret) return 'skipped';

  const piId = String(paymentIntent.id);
  const { data: existing } = await supabase
    .from('analytics_purchase_events')
    .select('sent_at')
    .eq('stripe_payment_intent_id', piId)
    .maybeSingle();
  if (existing?.sent_at) return 'already_sent';
  if (!existing) {
    await supabase
      .from('analytics_purchase_events')
      .upsert({ stripe_payment_intent_id: piId, platform }, { onConflict: 'stripe_payment_intent_id', ignoreDuplicates: true });
  }

  // GA4 convention: value excludes tax and shipping; tax is its own parameter
  const baseCents = Number(md.base_price_cents ?? 0);
  const taxCents = Number(md.tax_amount_cents ?? 0);
  const value = baseCents / 100;
  const destinationType = String(md.destination_country ?? 'US').toUpperCase() === 'US' ? 'domestic' : 'international';

  const params: Record<string, unknown> = {
    transaction_id: piId,
    value,
    tax: taxCents / 100,
    currency: String(paymentIntent.currency ?? 'usd').toUpperCase(),
    quantity: 1,
    destination_type: destinationType,
    items: [{ item_id: 'postcard', item_name: 'Postcard', price: value, quantity: 1 }],
    engagement_time_msec: 1,
  };
  if (md.ga_creation_id) params.creation_id = md.ga_creation_id;
  // Test-mode payments show up in DebugView instead of polluting reports
  if (!paymentIntent.livemode) params.debug_mode = 1;

  const url = `https://www.google-analytics.com/mp/collect?firebase_app_id=${encodeURIComponent(appId)}&api_secret=${encodeURIComponent(apiSecret)}`;
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({
      app_instance_id: appInstanceId,
      timestamp_micros: eventCreatedSeconds * 1_000_000,
      events: [{ name: 'purchase', params }],
    }),
  });
  if (!res.ok) throw new Error(`GA4 Measurement Protocol responded ${res.status}`);

  await supabase
    .from('analytics_purchase_events')
    .update({ sent_at: new Date().toISOString() })
    .eq('stripe_payment_intent_id', piId);
  return 'sent';
}
