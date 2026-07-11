import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  PaymentProviderPort,
} from '../ports/payment-provider.port';

/**
 * Dev-only stand-in for a real gateway. No STRIPE_SECRET_KEY/RAZORPAY
 * credentials exist yet (see SECURITY.md), so this lets the full checkout →
 * order → review flow be demoed end-to-end without them. `payments.module.ts`
 * is the only place this is ever selected, and only when
 * `process.env.NODE_ENV !== 'production'` — never reachable from a
 * production build, by construction rather than by a runtime flag someone
 * could flip in prod.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProviderPort {
  private readonly logger = new Logger(MockPaymentProvider.name);
  readonly isMock = true;

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
    this.logger.warn(
      `Mock payment intent created for order ${input.orderId} (${input.amountMinorUnits} ${input.currency}) — no real gateway is integrated.`,
    );
    return {
      providerRef: `mock_${randomUUID()}`,
      clientSecret: `mock_secret_${randomUUID()}`,
    };
  }

  verifyWebhookSignature(): boolean {
    return false;
  }
}
