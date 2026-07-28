import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { RazorpayPaymentProvider } from './razorpay-payment.provider';

const ordersCreate = jest.fn();
const ordersFetchPayments = jest.fn();
const paymentsRefund = jest.fn();

jest.mock('razorpay', () =>
  jest.fn().mockImplementation(() => ({
    orders: { create: ordersCreate, fetchPayments: ordersFetchPayments },
    payments: { refund: paymentsRefund },
  })),
);

const KEY_ID = 'rzp_test_key';
const KEY_SECRET = 'test_secret';
const WEBHOOK_SECRET = 'test_webhook_secret';

const config = {
  getOrThrow: (key: string) =>
    ({
      RAZORPAY_KEY_ID: KEY_ID,
      RAZORPAY_KEY_SECRET: KEY_SECRET,
      RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
    })[key],
} as unknown as ConfigService;

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

describe('RazorpayPaymentProvider', () => {
  let provider: RazorpayPaymentProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new RazorpayPaymentProvider(config);
  });

  describe('createPaymentIntent', () => {
    it('creates a Razorpay order in paise and returns a client-safe checkout handle', async () => {
      ordersCreate.mockResolvedValue({ id: 'order_abc' });

      const result = await provider.createPaymentIntent({
        orderId: 'o1',
        amountMinorUnits: 8500000,
        currency: 'INR',
      });

      // Razorpay denominates in paise, which is already the *MinorUnits
      // convention — the amount must pass through with no conversion.
      expect(ordersCreate).toHaveBeenCalledWith({
        amount: 8500000,
        currency: 'INR',
        receipt: 'o1',
        notes: { orderId: 'o1' },
      });
      expect(result.providerRef).toBe('order_abc');
      expect(result.checkout).toEqual({ keyId: KEY_ID, orderId: 'order_abc', simulated: false });
    });

    // The key secret and webhook secret must never reach the browser. This is
    // the boundary that keeps them server-side.
    it('never exposes a secret in the checkout handle', async () => {
      ordersCreate.mockResolvedValue({ id: 'order_abc' });

      const { checkout } = await provider.createPaymentIntent({
        orderId: 'o1',
        amountMinorUnits: 100,
        currency: 'INR',
      });

      expect(JSON.stringify(checkout)).not.toContain(KEY_SECRET);
      expect(JSON.stringify(checkout)).not.toContain(WEBHOOK_SECRET);
    });
  });

  describe('parseWebhookEvent', () => {
    function webhook(event: string, orderId?: string) {
      const body = Buffer.from(
        JSON.stringify({
          event,
          payload: { payment: { entity: { id: 'pay_1', order_id: orderId } } },
        }),
      );
      return { body, signature: sign(body.toString(), WEBHOOK_SECRET) };
    }

    it('maps payment.captured onto a succeeded outcome carrying the ORDER id', async () => {
      const { body, signature } = webhook('payment.captured', 'order_abc');

      // The Payment row's providerRef is the order id, not the payment id —
      // returning the wrong one would silently fail to match any local row.
      expect(provider.parseWebhookEvent(body, signature)).toEqual({
        kind: 'succeeded',
        providerRef: 'order_abc',
      });
    });

    it('maps payment.failed onto a failed outcome', () => {
      const { body, signature } = webhook('payment.failed', 'order_abc');

      expect(provider.parseWebhookEvent(body, signature)).toEqual({
        kind: 'failed',
        providerRef: 'order_abc',
      });
    });

    it('ignores event types it does not act on', () => {
      const { body, signature } = webhook('refund.created', 'order_abc');

      expect(provider.parseWebhookEvent(body, signature)).toEqual({
        kind: 'ignored',
        description: 'refund.created',
      });
    });

    // The port's contract: an invalid signature THROWS, it does not return an
    // `ignored` outcome that a caller might treat as benign.
    it('throws on a forged signature', () => {
      const { body } = webhook('payment.captured', 'order_abc');

      expect(() => provider.parseWebhookEvent(body, 'forged')).toThrow(BadRequestException);
    });

    it('throws when the payload is signed with the wrong secret', () => {
      const { body } = webhook('payment.captured', 'order_abc');
      const wrongSignature = sign(body.toString(), 'not_the_webhook_secret');

      expect(() => provider.parseWebhookEvent(body, wrongSignature)).toThrow(BadRequestException);
    });

    it('throws on an empty signature header', () => {
      const { body } = webhook('payment.captured', 'order_abc');

      expect(() => provider.parseWebhookEvent(body, '')).toThrow(BadRequestException);
    });

    // Signature verification must run against the exact bytes received. A body
    // mutated after signing must not verify.
    it('rejects a body that was tampered with after signing', () => {
      const { signature } = webhook('payment.captured', 'order_abc');
      const tampered = Buffer.from(
        JSON.stringify({
          event: 'payment.captured',
          payload: { payment: { entity: { id: 'pay_1', order_id: 'order_ATTACKER' } } },
        }),
      );

      expect(() => provider.parseWebhookEvent(tampered, signature)).toThrow(BadRequestException);
    });

    it('throws when a captured event carries no order id', () => {
      const body = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: {} }));
      const signature = sign(body.toString(), WEBHOOK_SECRET);

      expect(() => provider.parseWebhookEvent(body, signature)).toThrow(BadRequestException);
    });

    it('throws when a failed event carries no order id', () => {
      const body = Buffer.from(JSON.stringify({ event: 'payment.failed', payload: {} }));
      const signature = sign(body.toString(), WEBHOOK_SECRET);

      expect(() => provider.parseWebhookEvent(body, signature)).toThrow(BadRequestException);
    });
  });

  describe('verifyCheckoutResult', () => {
    it('accepts a correctly-signed "<order_id>|<payment_id>" payload', () => {
      const signature = sign('order_abc|pay_1', KEY_SECRET);

      expect(
        provider.verifyCheckoutResult({
          providerRef: 'order_abc',
          paymentId: 'pay_1',
          signature,
        }),
      ).toEqual({ kind: 'succeeded', providerRef: 'order_abc' });
    });

    // This payload arrives from a browser and is fully attacker-controllable.
    it('throws on a forged signature', () => {
      expect(() =>
        provider.verifyCheckoutResult({
          providerRef: 'order_abc',
          paymentId: 'pay_1',
          signature: 'forged',
        }),
      ).toThrow(BadRequestException);
    });

    // Signing the right payload with the webhook secret must not pass either —
    // the two secrets are distinct and are not interchangeable.
    it('rejects a payload signed with the webhook secret instead of the key secret', () => {
      const signature = sign('order_abc|pay_1', WEBHOOK_SECRET);

      expect(() =>
        provider.verifyCheckoutResult({ providerRef: 'order_abc', paymentId: 'pay_1', signature }),
      ).toThrow(BadRequestException);
    });

    // A signature valid for one order must not confirm a different one.
    it('rejects a signature replayed against a different order', () => {
      const signature = sign('order_abc|pay_1', KEY_SECRET);

      expect(() =>
        provider.verifyCheckoutResult({
          providerRef: 'order_VICTIM',
          paymentId: 'pay_1',
          signature,
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('refund', () => {
    it('resolves the captured payment for the order and refunds it', async () => {
      ordersFetchPayments.mockResolvedValue({
        items: [
          { id: 'pay_failed', status: 'failed' },
          { id: 'pay_ok', status: 'captured' },
        ],
      });
      paymentsRefund.mockResolvedValue({ id: 'rfnd_1', amount: 5000 });

      const result = await provider.refund({ providerRef: 'order_abc' });

      expect(ordersFetchPayments).toHaveBeenCalledWith('order_abc');
      // No amount means a full refund — Razorpay treats an absent amount that
      // way, so the key must be omitted rather than sent as undefined.
      expect(paymentsRefund).toHaveBeenCalledWith('pay_ok', {});
      expect(result).toEqual({ refundRef: 'rfnd_1' });
    });

    it('passes a partial amount through in paise', async () => {
      ordersFetchPayments.mockResolvedValue({ items: [{ id: 'pay_ok', status: 'captured' }] });
      paymentsRefund.mockResolvedValue({ id: 'rfnd_1', amount: 2500 });

      await provider.refund({ providerRef: 'order_abc', amountMinorUnits: 2500 });

      expect(paymentsRefund).toHaveBeenCalledWith('pay_ok', { amount: 2500 });
    });

    // Returning success here would let PaymentsService mark the row REFUNDED
    // with no money moving — the exact failure this module exists to prevent.
    it('refuses when no captured payment exists for the order', async () => {
      ordersFetchPayments.mockResolvedValue({ items: [{ id: 'pay_x', status: 'authorized' }] });

      await expect(provider.refund({ providerRef: 'order_abc' })).rejects.toThrow(
        BadRequestException,
      );
      expect(paymentsRefund).not.toHaveBeenCalled();
    });

    it('refuses when the order has no payments at all', async () => {
      ordersFetchPayments.mockResolvedValue({ items: [] });

      await expect(provider.refund({ providerRef: 'order_abc' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
