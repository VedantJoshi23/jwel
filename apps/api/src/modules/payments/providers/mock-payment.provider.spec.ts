import { ServiceUnavailableException } from '@nestjs/common';
import { MockPaymentProvider } from './mock-payment.provider';

describe('MockPaymentProvider', () => {
  const provider = new MockPaymentProvider();

  describe('createPaymentIntent', () => {
    it('returns a recognisably fake order ref', async () => {
      const result = await provider.createPaymentIntent({
        orderId: 'o1',
        amountMinorUnits: 5000,
        currency: 'INR',
      });

      // The `mock_` prefix is what makes a simulated payment identifiable in
      // the payments table after the fact.
      expect(result.providerRef).toMatch(/^mock_order_/);
      expect(result.checkout.orderId).toBe(result.providerRef);
    });

    // If this ever reached a real Razorpay Checkout modal it would fail
    // immediately and visibly, rather than half-working against a live account.
    it('returns a key id that could never authenticate against Razorpay', async () => {
      const result = await provider.createPaymentIntent({
        orderId: 'o1',
        amountMinorUnits: 5000,
        currency: 'INR',
      });

      expect(result.checkout.keyId).toBe('rzp_mock_key');
      expect(result.checkout.keyId).not.toMatch(/^rzp_(live|test)_/);
    });

    // This flag is what stops a PAYMENTS_MODE=simulated deployment (RUNBOOK
    // §13) from opening a real Razorpay modal it cannot possibly complete.
    // The web bundle there is built for production, so the client has no way
    // to work this out for itself — the server has to say so.
    it('declares itself simulated so the client skips the payment modal', async () => {
      const result = await provider.createPaymentIntent({
        orderId: 'o1',
        amountMinorUnits: 5000,
        currency: 'INR',
      });

      expect(result.checkout.simulated).toBe(true);
    });

    it('issues a distinct ref per call so payment rows do not collide', async () => {
      const input = { orderId: 'o1', amountMinorUnits: 100, currency: 'INR' };

      const [a, b] = await Promise.all([
        provider.createPaymentIntent(input),
        provider.createPaymentIntent(input),
      ]);

      expect(a.providerRef).not.toEqual(b.providerRef);
    });
  });

  describe('parseWebhookEvent', () => {
    // The mock confirms inline at intent creation, so it has no webhook. A
    // real gateway posting here means the environment resolved to the mock by
    // mistake — failing loudly beats 200-ing and telling the gateway to stop
    // retrying a delivery that was never processed.
    it('refuses to decode webhooks rather than silently ignoring them', () => {
      expect(() => provider.parseWebhookEvent()).toThrow(ServiceUnavailableException);
    });
  });

  describe('verifyCheckoutResult', () => {
    // Same reasoning: inventing a confirmation here would let a browser mark
    // an order paid in an environment with no gateway behind it.
    it('refuses to verify a signature it has no secret for', () => {
      expect(() =>
        provider.verifyCheckoutResult({
          providerRef: 'mock_order_1',
          paymentId: 'pay_1',
          signature: 'anything',
        }),
      ).toThrow(ServiceUnavailableException);
    });
  });

  describe('refund', () => {
    // Unlike the two above, this returns instead of throwing: no money ever
    // moved, so there is nothing to fail to move back, and the Returns flow
    // stays demoable in the environments this provider exists for.
    it('returns a recognisably fake refund ref', async () => {
      const result = await provider.refund({ providerRef: 'mock_order_1' });

      expect(result.refundRef).toMatch(/^mock_refund_/);
    });
  });

  it('is identifiable as a mock, which PaymentsService uses to self-confirm', () => {
    expect(provider.isMock).toBe(true);
  });
});
