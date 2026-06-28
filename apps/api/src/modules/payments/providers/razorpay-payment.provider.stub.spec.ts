import { ServiceUnavailableException } from '@nestjs/common';
import { RazorpayPaymentProviderStub } from './razorpay-payment.provider.stub';

describe('RazorpayPaymentProviderStub', () => {
  const provider = new RazorpayPaymentProviderStub();

  it('throws ServiceUnavailableException rather than silently no-op-ing', async () => {
    await expect(
      provider.createPaymentIntent({ orderId: 'o1', amountMinorUnits: 1000, currency: 'INR' }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('always reports webhook signatures as unverifiable', () => {
    expect(provider.verifyWebhookSignature(Buffer.from(''), 'sig')).toBe(false);
  });
});
