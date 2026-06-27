import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  PaymentProviderPort,
} from '../ports/payment-provider.port';

/**
 * Stub only — per PRODUCT.md/ARCHITECTURE.md/SECURITY.md, Razorpay is wired
 * behind the PaymentProviderPort but intentionally NOT activated this
 * milestone. No live credentials exist in any environment; calling this
 * adapter is a configuration error, not a runtime path that should ever be
 * exercised in production, so it fails loudly instead of silently no-op'ing.
 */
@Injectable()
export class RazorpayPaymentProviderStub implements PaymentProviderPort {
  async createPaymentIntent(_input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
    throw new ServiceUnavailableException(
      'Razorpay is configured as a stub provider and is not active. Activate it explicitly before routing payments through it.',
    );
  }

  verifyWebhookSignature(_rawBody: Buffer, _signatureHeader: string): boolean {
    return false;
  }
}
