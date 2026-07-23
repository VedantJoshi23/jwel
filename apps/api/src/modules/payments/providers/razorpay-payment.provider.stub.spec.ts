import { ServiceUnavailableException } from '@nestjs/common';
import { RazorpayPaymentProviderStub } from './razorpay-payment.provider.stub';

describe('RazorpayPaymentProviderStub', () => {
  const provider = new RazorpayPaymentProviderStub();

  it('throws ServiceUnavailableException rather than silently no-op-ing', async () => {
    await expect(
      provider.createPaymentIntent({ orderId: 'o1', amountMinorUnits: 1000, currency: 'INR' }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('refuses to decode webhooks rather than silently ignoring them', () => {
    expect(() => provider.parseWebhookEvent(Buffer.from(''), 'sig')).toThrow(
      ServiceUnavailableException,
    );
  });
});
