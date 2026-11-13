// Shared Stripe refund helper for the address-request functions.
// submit-postcard keeps its own copy because it refunds on many inline failure paths.
import { sendRefundEmail, type RefundReason } from './refund-email.ts';

export async function refundPaymentIntent(
  stripeKey: string,
  paymentIntentId: string,
  userId: string,
  reason: RefundReason,
): Promise<boolean> {
  try {
    const res = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        // A retry after a transient failure must never double refund.
        'Idempotency-Key': `refund-${paymentIntentId}`,
      },
      body: new URLSearchParams({ payment_intent: paymentIntentId, reason: 'requested_by_customer' }),
    });
    const data = await res.json();
    const alreadyRefunded = data?.error?.code === 'charge_already_refunded';
    if (!res.ok && !alreadyRefunded) {
      console.error('[refund] Stripe refund failed:', JSON.stringify(data));
      return false;
    }
    if (res.ok) {
      await sendRefundEmail({
        userId,
        paymentIntentId,
        amountCents: data.amount,
        currency: data.currency,
        reason,
      });
    }
    return true;
  } catch (err) {
    console.error('[refund] Stripe refund threw:', err);
    return false;
  }
}
