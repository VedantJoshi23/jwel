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
 * Provider-neutral result of decoding an inbound webhook. Adapters map their
 * own event vocabulary onto this so PaymentsService never branches on a
 * gateway-specific event type.
 */
export type WebhookOutcome =
  | { kind: 'succeeded'; providerRef: string }
  | { kind: 'failed'; providerRef: string }
  | { kind: 'ignored'; description: string };

/**
 * Port per ARCHITECTURE.md §6 / SECURITY.md §4 — Stripe is the live adapter,
 * Razorpay is wired as a stub adapter that throws if actually invoked. No
 * payment-provider-specific code may leak outside an implementation of this
 * interface; PaymentsService only ever depends on this port.
 */
export interface PaymentProviderPort {
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult>;

  /**
   * Verifies the signature and decodes the payload in one step, because the
   * two are inseparable for every real gateway: Stripe's `constructEvent`
   * authenticates and parses together, and exposing a boolean-only check
   * invites a caller to parse an unverified body. Implementations MUST throw
   * on an invalid signature rather than returning an `ignored` outcome.
   */
  parseWebhookEvent(rawBody: Buffer, signatureHeader: string): WebhookOutcome;
}

export const PAYMENT_PROVIDER_STRIPE = 'PAYMENT_PROVIDER_STRIPE';
export const PAYMENT_PROVIDER_RAZORPAY = 'PAYMENT_PROVIDER_RAZORPAY';
