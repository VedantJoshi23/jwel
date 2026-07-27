import { BadRequestException } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsController', () => {
  let service: { handleWebhook: jest.Mock; confirmFromCheckout: jest.Mock };
  let controller: PaymentsController;

  beforeEach(() => {
    service = {
      handleWebhook: jest.fn().mockResolvedValue(undefined),
      confirmFromCheckout: jest.fn().mockResolvedValue(undefined),
    };
    controller = new PaymentsController(service as unknown as PaymentsService);
  });

  describe('razorpayWebhook', () => {
    it('throws BadRequestException when the Razorpay signature header is missing', async () => {
      const req = { rawBody: Buffer.from('') } as any;
      await expect(controller.razorpayWebhook(req, '')).rejects.toThrow(BadRequestException);
      expect(service.handleWebhook).not.toHaveBeenCalled();
    });

    // Without the raw body the signature cannot be verified at all — a parsed
    // and re-serialised body does not produce the same HMAC.
    it('throws BadRequestException when the raw body is missing', async () => {
      const req = {} as any;
      await expect(controller.razorpayWebhook(req, 'sig')).rejects.toThrow(BadRequestException);
      expect(service.handleWebhook).not.toHaveBeenCalled();
    });

    it('delegates to PaymentsService.handleWebhook and acknowledges receipt', async () => {
      const req = { rawBody: Buffer.from('payload') } as any;
      const result = await controller.razorpayWebhook(req, 'sig');
      expect(service.handleWebhook).toHaveBeenCalledWith(req.rawBody, 'sig');
      expect(result).toEqual({ received: true });
    });
  });

  describe('verifyPayment', () => {
    it('maps the wire-format DTO onto the port’s CheckoutResult shape', async () => {
      const result = await controller.verifyPayment({
        razorpayOrderId: 'order_1',
        razorpayPaymentId: 'pay_1',
        razorpaySignature: 'sig',
      });

      expect(service.confirmFromCheckout).toHaveBeenCalledWith({
        providerRef: 'order_1',
        paymentId: 'pay_1',
        signature: 'sig',
      });
      expect(result).toEqual({ verified: true });
    });

    it('propagates a verification failure rather than reporting success', async () => {
      service.confirmFromCheckout.mockRejectedValue(new BadRequestException('bad signature'));

      await expect(
        controller.verifyPayment({
          razorpayOrderId: 'order_1',
          razorpayPaymentId: 'pay_1',
          razorpaySignature: 'forged',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
