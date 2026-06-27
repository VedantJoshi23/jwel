export interface CreatePaymentIntentInput {
  orderId: string;
  amountMinorUnits: number;
  currency: string;
}

export interface CreatePaymentIntentResult {
  providerRef: string;
  clientSecret: string;
}

/**
 * Port per ARCHITECTURE.md §6 / SECURITY.md §4 — Stripe is the live adapter,
 * Razorpay is wired as a stub adapter that throws if actually invoked. No
 * payment-provider-specific code may leak outside an implementation of this
 * interface; PaymentsService only ever depends on this port.
 */
export interface PaymentProviderPort {
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult>;
  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string): boolean;
}

export const PAYMENT_PROVIDER_STRIPE = 'PAYMENT_PROVIDER_STRIPE';
export const PAYMENT_PROVIDER_RAZORPAY = 'PAYMENT_PROVIDER_RAZORPAY';
