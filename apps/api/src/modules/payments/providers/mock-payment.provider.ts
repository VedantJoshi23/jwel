import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CheckoutResult,
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  PaymentProviderPort,
  RefundInput,
  RefundResult,
  WebhookOutcome,
} from '../ports/payment-provider.port';

/**
 * Dev-only stand-in for a real gateway, so the full checkout → order → review
 * flow can be demoed without Razorpay credentials. `payments.module.ts` is the
 * only place this is ever selected, and only when
 * `process.env.NODE_ENV !== 'production'` or under the explicit
 * `PAYMENTS_MODE=simulated` opt-in — never reachable from a plain production
 * build, by construction rather than by a runtime flag someone could flip.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProviderPort {
  private readonly logger = new Logger(MockPaymentProvider.name);
  readonly isMock = true;

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
    this.logger.warn(
      `Mock payment intent created for order ${input.orderId} (${input.amountMinorUnits} ${input.currency}) — no real gateway is integrated.`,
    );
    const orderId = `mock_order_${randomUUID()}`;
    return {
      providerRef: orderId,
      // A recognisably fake key id: if this ever reached a real Razorpay
      // Checkout modal it would fail immediately and visibly, rather than
      // half-working against someone's live account.
      checkout: { keyId: 'rzp_mock_key', orderId, simulated: true },
    };
  }

  // The mock confirms payments inline at intent-creation time (see
  // PaymentsService.initiateForOrder), so it has no webhook to receive.
  // Reaching here means a real gateway is posting to an environment that
  // resolved to the mock — a misconfiguration worth failing loudly on rather
  // than silently 200-ing, which would tell the gateway to stop retrying.
  parseWebhookEvent(): WebhookOutcome {
    throw new ServiceUnavailableException(
      'No payment gateway is configured; this environment cannot verify webhook signatures.',
    );
  }

  // Same reasoning, and the same reason this does not just return `succeeded`:
  // the mock has already marked the payment succeeded inline, so a browser
  // calling verify against a mock environment is either a stale client or a
  // misconfiguration. Failing loudly beats inventing a confirmation.
  verifyCheckoutResult(_result: CheckoutResult): WebhookOutcome {
    throw new ServiceUnavailableException(
      'No payment gateway is configured; this environment cannot verify payment signatures.',
    );
  }

  // No money ever moved, so there is nothing to move back. Returns a
  // recognisably fake ref rather than throwing, so the Returns flow stays
  // demoable end-to-end in the same environments this provider exists for.
  async refund(input: RefundInput): Promise<RefundResult> {
    this.logger.warn(
      `Mock refund for ${input.providerRef} — no real gateway is integrated, no money has moved.`,
    );
    return { refundRef: `mock_refund_${randomUUID()}` };
  }
}
