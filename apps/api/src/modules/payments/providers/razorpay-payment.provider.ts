import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import Razorpay from 'razorpay';
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
 * Razorpay adapter — the sole payment provider (ADR-0005), integrated via
 * Standard Checkout: this creates an Order server-side, the browser opens
 * Razorpay's hosted modal with the resulting `order_id`, and confirmation
 * arrives on the `payment.captured` webhook.
 *
 * Razorpay denominates in paise, which is already this codebase's
 * `*MinorUnits` convention, so no conversion happens anywhere in here.
 */
@Injectable()
export class RazorpayPaymentProvider implements PaymentProviderPort {
  private readonly logger = new Logger(RazorpayPaymentProvider.name);
  private readonly client: Razorpay;
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(config: ConfigService) {
    this.keyId = config.getOrThrow<string>('RAZORPAY_KEY_ID');
    this.keySecret = config.getOrThrow<string>('RAZORPAY_KEY_SECRET');
    this.webhookSecret = config.getOrThrow<string>('RAZORPAY_WEBHOOK_SECRET');
    this.client = new Razorpay({ key_id: this.keyId, key_secret: this.keySecret });
  }

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult> {
    const order = await this.client.orders.create({
      amount: input.amountMinorUnits,
      currency: input.currency,
      // Razorpay's own idempotency handle. Sending our order id means a
      // retried checkout for the same order is traceable on their dashboard
      // rather than appearing as an unrelated second attempt.
      receipt: input.orderId,
      notes: { orderId: input.orderId },
    });

    return {
      providerRef: order.id,
      // keyId is public by design — it is handed to the browser to open the
      // modal. The secret and webhook secret never leave this class.
      checkout: { keyId: this.keyId, orderId: order.id, simulated: false },
    };
  }

  /**
   * Verifies `X-Razorpay-Signature` — an HMAC-SHA256 of the exact raw body —
   * before anything in the payload is trusted. Throws on a bad signature, per
   * the port contract, so a forged event can never reach PaymentsService.
   */
  parseWebhookEvent(rawBody: Buffer, signatureHeader: string): WebhookOutcome {
    if (!this.isValidSignature(rawBody, signatureHeader, this.webhookSecret)) {
      throw new BadRequestException('Invalid Razorpay webhook signature');
    }

    const event = JSON.parse(rawBody.toString('utf8')) as RazorpayWebhookEvent;
    // The `Payment` row's providerRef is the Razorpay *order* id, so that is
    // what has to come back out here — not the payment id.
    const orderId = event.payload?.payment?.entity?.order_id;

    if (event.event === 'payment.captured') {
      if (!orderId) {
        throw new BadRequestException('Razorpay payment.captured event has no order_id');
      }
      return { kind: 'succeeded', providerRef: orderId };
    }
    if (event.event === 'payment.failed') {
      if (!orderId) {
        throw new BadRequestException('Razorpay payment.failed event has no order_id');
      }
      return { kind: 'failed', providerRef: orderId };
    }
    return { kind: 'ignored', description: event.event };
  }

  /**
   * The Checkout modal signs `order_id|payment_id` with the key secret. Note
   * this proves the *browser* presented a correctly-signed result, which is a
   * weaker claim than the webhook's — see the port docs and SECURITY.md §4.
   */
  verifyCheckoutResult(result: CheckoutResult): WebhookOutcome {
    const payload = Buffer.from(`${result.providerRef}|${result.paymentId}`, 'utf8');
    if (!this.isValidSignature(payload, result.signature, this.keySecret)) {
      throw new BadRequestException('Invalid Razorpay payment signature');
    }
    return { kind: 'succeeded', providerRef: result.providerRef };
  }

  /**
   * Razorpay refunds are issued against a *payment* id, but the `Payment` row
   * stores the *order* id. Rather than add a column for the payment id, this
   * resolves it through the gateway at refund time — refunds are rare, and
   * the gateway is the authority on which attempt actually captured.
   */
  async refund(input: RefundInput): Promise<RefundResult> {
    const { items } = await this.client.orders.fetchPayments(input.providerRef);
    const captured = items.find((payment) => payment.status === 'captured');

    if (!captured) {
      // Refusing is right: returning success here would mark the Payment row
      // REFUNDED with no money moving, which is the failure mode this whole
      // module is built to avoid.
      throw new BadRequestException(
        `No captured Razorpay payment found for order ${input.providerRef}; nothing to refund`,
      );
    }

    const refund = await this.client.payments.refund(captured.id, {
      ...(input.amountMinorUnits !== undefined ? { amount: input.amountMinorUnits } : {}),
    });

    this.logger.log(
      `Refunded ${refund.amount} paise against Razorpay payment ${captured.id} (order ${input.providerRef})`,
    );
    return { refundRef: refund.id };
  }

  /**
   * Constant-time comparison. Razorpay's own SDK helper compares signature
   * strings with `===`, which leaks timing; this does not, and it avoids a
   * deep import into the SDK's undocumented internals for the same primitive.
   */
  private isValidSignature(payload: Buffer, signature: string, secret: string): boolean {
    if (!signature) return false;

    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const actualBuf = Buffer.from(signature, 'utf8');

    // timingSafeEqual throws on a length mismatch, so the lengths have to be
    // compared first — that comparison leaks only the length, never content.
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  }
}

interface RazorpayWebhookEvent {
  event: string;
  payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
}
