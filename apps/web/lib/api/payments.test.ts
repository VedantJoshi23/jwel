import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyPayment } from './payments';

describe('verifyPayment', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ verified: true }), { status: 200 })),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('POSTs the signed handler payload to /payments/verify', async () => {
    await verifyPayment({
      razorpayOrderId: 'order_1',
      razorpayPaymentId: 'pay_1',
      razorpaySignature: 'sig',
    });

    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/payments/verify');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      razorpayOrderId: 'order_1',
      razorpayPaymentId: 'pay_1',
      razorpaySignature: 'sig',
    });
  });

  // Deliberately unauthenticated — the signature is the credential, and a
  // shopper whose token expired mid-checkout must still be able to confirm a
  // payment they actually made. See payments.controller.ts.
  it('sends no Authorization header', async () => {
    await verifyPayment({
      razorpayOrderId: 'order_1',
      razorpayPaymentId: 'pay_1',
      razorpaySignature: 'sig',
    });

    const [, options] = (fetch as any).mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('propagates an API error instead of reporting success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Invalid Razorpay payment signature' }), {
          status: 400,
        }),
      ),
    );

    await expect(
      verifyPayment({ razorpayOrderId: 'o', razorpayPaymentId: 'p', razorpaySignature: 'forged' }),
    ).rejects.toThrow('Invalid Razorpay payment signature');
  });
});
