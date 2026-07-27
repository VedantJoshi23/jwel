export interface CreatePaymentIntentInput {
  orderId: string;
  amountMinorUnits: number;
  currency: string;
}

/**
 * Everything the browser needs to open the gateway's own checkout UI. Only
 * client-safe values may appear here — `keyId` is a *public* key by design,
 * and nothing in this object is a secret.
 */
export interface CheckoutHandle {
  keyId: string;
  orderId: string;
  /**
   * True when no real gateway is behind this checkout, so the client must skip
   * the payment modal instead of opening one that cannot succeed.
   *
   * The *server* decides this, deliberately. The client cannot infer it: a
   * `PAYMENTS_MODE=simulated` deployment (RUNBOOK §13) runs the API in
   * production with the mock provider while the web bundle is also built for
   * production, so any client-side `NODE_ENV` check would conclude payments
   * are real and open a modal against a key that cannot authenticate.
   */
  simulated: boolean;
}

export interface CreatePaymentIntentResult {
  /** Persisted on the `Payment` row and used to correlate later callbacks. */
  providerRef: string;
  checkout: CheckoutHandle;
}

/**
 * What the gateway's checkout UI hands back to the *browser* on success.
 * Every field here is attacker-controllable — it arrives over a client
 * request, not a server-to-server callback — which is why
 * `verifyCheckoutResult` exists and why its outcome is never the sole basis
 * for treating an order as paid (SECURITY.md §4).
 */
export interface CheckoutResult {
  providerRef: string;
  paymentId: string;
  signature: string;
}

export interface RefundInput {
  /** The `providerRef` stored on the `Payment` row. */
  providerRef: string;
  /** Omit for a full refund. */
  amountMinorUnits?: number;
}

export interface RefundResult {
  refundRef: string;
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
 * Port per ARCHITECTURE.md §6 / SECURITY.md §4. Razorpay is the sole adapter
 * (ADR-0005); the port is kept because it is what made dropping Stripe a
 * contained change rather than a rewrite. No payment-provider-specific code
 * may leak outside an implementation of this interface; PaymentsService only
 * ever depends on this port.
 */
export interface PaymentProviderPort {
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult>;

  /**
   * Verifies the signature and decodes the payload in one step, because the
   * two are inseparable for every real gateway: exposing a boolean-only check
   * invites a caller to parse an unverified body. Implementations MUST throw
   * on an invalid signature rather than returning an `ignored` outcome.
   */
  parseWebhookEvent(rawBody: Buffer, signatureHeader: string): WebhookOutcome;

  /**
   * Verifies a checkout result relayed by the browser. Same contract as
   * `parseWebhookEvent`: throw on a bad signature, never return `ignored` for
   * one. A successful outcome here means "this browser presented a
   * correctly-signed result", which is weaker than the signed webhook and is
   * treated as such by PaymentsService.
   */
  verifyCheckoutResult(result: CheckoutResult): WebhookOutcome;

  /**
   * Moves real money back. Distinct from marking a `Payment` row REFUNDED,
   * which is bookkeeping — see PaymentsService.refundForOrder, which does both
   * in the order that fails safe.
   */
  refund(input: RefundInput): Promise<RefundResult>;
}

export const PAYMENT_PROVIDER_RAZORPAY = 'PAYMENT_PROVIDER_RAZORPAY';
