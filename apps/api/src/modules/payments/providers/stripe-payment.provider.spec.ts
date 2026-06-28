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

  describe('verifyWebhookSignature', () => {
    it('returns true when Stripe verifies the signature without throwing', () => {
      mockConstructEvent.mockReturnValue({ type: 'payment_intent.succeeded' });
      expect(provider.verifyWebhookSignature(Buffer.from(''), 'good-sig')).toBe(true);
    });

    it('returns false when Stripe rejects the signature', () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error('invalid signature');
      });
      expect(provider.verifyWebhookSignature(Buffer.from(''), 'bad-sig')).toBe(false);
    });
  });

  describe('constructEvent', () => {
    it('returns the verified Stripe event', () => {
      mockConstructEvent.mockReturnValue({ type: 'payment_intent.succeeded' });
      expect(provider.constructEvent(Buffer.from(''), 'sig')).toEqual({ type: 'payment_intent.succeeded' });
    });
  });
});
