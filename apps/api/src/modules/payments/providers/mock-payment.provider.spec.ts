import { ServiceUnavailableException } from '@nestjs/common';
import { MockPaymentProvider } from './mock-payment.provider';

describe('MockPaymentProvider', () => {
  const provider = new MockPaymentProvider();

  describe('createPaymentIntent', () => {
    it('returns a recognisably fake ref and secret', async () => {
      const result = await provider.createPaymentIntent({
        orderId: 'o1',
        amountMinorUnits: 5000,
        currency: 'INR',
      });

      // The `mock_` prefix is what makes a simulated payment identifiable in
      // the payments table after the fact.
      expect(result.providerRef).toMatch(/^mock_/);
      expect(result.clientSecret).toMatch(/^mock_secret_/);
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

  it('is identifiable as a mock, which PaymentsService uses to self-confirm', () => {
    expect(provider.isMock).toBe(true);
  });
});
