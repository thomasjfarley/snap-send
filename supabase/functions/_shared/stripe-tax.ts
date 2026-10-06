async function stripeRequest(
  stripeKey: string,
  path: string,
  body?: URLSearchParams,
  idempotencyKey?: string,
) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    ...(body ? { body } : {}),
  });
  const data = await response.json();
  return { response, data };
}

export async function recordTaxTransaction(
  stripeKey: string,
  paymentIntentId: string,
  calculationId?: string,
): Promise<{ succeeded: boolean; transactionId?: string }> {
  if (!calculationId) {
    console.error('[stripe-tax] PaymentIntent is missing its Stripe Tax calculation');
    return { succeeded: false };
  }

  const { response, data } = await stripeRequest(
    stripeKey,
    '/tax/transactions/create_from_calculation',
    new URLSearchParams({
      calculation: calculationId,
      reference: paymentIntentId,
    }),
    `postcard-tax-${paymentIntentId}`,
  );
  if (!response.ok || !data.id) {
    console.error('[stripe-tax] Transaction error:', response.status, JSON.stringify(data));
    return { succeeded: false };
  }

  const metadataResult = await stripeRequest(
    stripeKey,
    `/payment_intents/${paymentIntentId}`,
    new URLSearchParams({ 'metadata[tax_transaction_id]': data.id }),
  );
  if (!metadataResult.response.ok) {
    console.error(
      '[stripe-tax] PaymentIntent metadata update error:',
      metadataResult.response.status,
      JSON.stringify(metadataResult.data),
    );
    return { succeeded: false };
  }

  return { succeeded: true, transactionId: data.id };
}

export async function reverseTaxTransaction(
  stripeKey: string,
  paymentIntentId: string,
  transactionId: string,
): Promise<boolean> {
  const { response, data } = await stripeRequest(
    stripeKey,
    '/tax/transactions/create_reversal',
    new URLSearchParams({
      mode: 'full',
      original_transaction: transactionId,
      reference: `${paymentIntentId}-refund`,
    }),
    `postcard-tax-refund-${paymentIntentId}`,
  );
  if (!response.ok) {
    console.error('[stripe-tax] Reversal error:', response.status, JSON.stringify(data));
    return false;
  }
  return true;
}
