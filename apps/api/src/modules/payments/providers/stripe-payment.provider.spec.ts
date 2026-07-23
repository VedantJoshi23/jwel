import { ConfigService } from '@nestjs/config';
import { StripePaymentProvider } from './stripe-payment.provider';

const mockPaymentIntentsCreate = jest.fn();
const mockConstructEvent = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: { create: mockPaymentIntentsCreate },
    webhooks: { constructEvent: mockConstructEvent },
  }));
});

describe('StripePaymentProvider', () => {
  let provider: StripePaymentProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    const config = {
      getOrThrow: jest.fn((key: string) => (key === 'STRIPE_SECRET_KEY' ? 'sk_test_x' : 'whsec_x')),
    } as unknown as ConfigService;
    provider = new StripePaymentProvider(config);
  });

  describe('createPaymentIntent', () => {
    it('creates a Stripe payment intent and maps the result', async () => {
      mockPaymentIntentsCreate.mockResolvedValue({ id: 'pi_123', client_secret: 'secret_123' });

      const result = await provider.createPaymentIntent({ orderId: 'o1', amountMinorUnits: 5000, currency: 'INR' });

      expect(mockPaymentIntentsCreate).toHaveBeenCalledWith({
        amount: 5000,
        currency: 'inr',
        metadata: { orderId: 'o1' },
      });
      expect(result).toEqual({ providerRef: 'pi_123', clientSecret: 'secret_123' });
    });

    it('lowercases the currency code for Stripe’s API', async () => {
      mockPaymentIntentsCreate.mockResolvedValue({ id: 'pi_1', client_secret: 's' });
      await provider.createPaymentIntent({ orderId: 'o1', amountMinorUnits: 100, currency: 'INR' });
      expect(mockPaymentIntentsCreate.mock.calls[0][0].currency).toBe('inr');
    });
  });

  describe('parseWebhookEvent', () => {
    it('maps payment_intent.succeeded to a succeeded outcome', () => {
      mockConstructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123' } },
      });

      expect(provider.parseWebhookEvent(Buffer.from(''), 'good-sig')).toEqual({
        kind: 'succeeded',
        providerRef: 'pi_123',
      });
    });

    it('maps payment_intent.payment_failed to a failed outcome', () => {
      mockConstructEvent.mockReturnValue({
        type: 'payment_intent.payment_failed',
        data: { object: { id: 'pi_456' } },
      });

      expect(provider.parseWebhookEvent(Buffer.from(''), 'good-sig')).toEqual({
        kind: 'failed',
        providerRef: 'pi_456',
      });
    });

    it('reports unrecognised event types as ignored rather than failing', () => {
      mockConstructEvent.mockReturnValue({ type: 'charge.refunded', data: { object: {} } });

      expect(provider.parseWebhookEvent(Buffer.from(''), 'good-sig')).toEqual({
        kind: 'ignored',
        description: 'charge.refunded',
      });
    });

    // The security-critical case: a forged body must never be decoded into an
    // outcome the caller could act on.
    it('propagates the error when Stripe rejects the signature', () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      expect(() => provider.parseWebhookEvent(Buffer.from(''), 'bad-sig')).toThrow(
        'invalid signature',
      );
    });

    it('verifies against the configured webhook secret', () => {
      mockConstructEvent.mockReturnValue({ type: 'x', data: { object: {} } });
      const body = Buffer.from('raw');

      provider.parseWebhookEvent(body, 'sig');

      expect(mockConstructEvent).toHaveBeenCalledWith(body, 'sig', 'whsec_x');
    });
  });
});
