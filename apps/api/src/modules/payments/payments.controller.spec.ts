import { BadRequestException } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsController', () => {
  let service: { handleStripeWebhook: jest.Mock };
  let controller: PaymentsController;

  beforeEach(() => {
    service = { handleStripeWebhook: jest.fn().mockResolvedValue(undefined) };
    controller = new PaymentsController(service as unknown as PaymentsService);
  });

  it('throws BadRequestException when the Stripe signature header is missing', async () => {
    const req = { rawBody: Buffer.from('') } as any;
    await expect(controller.stripeWebhook(req, '')).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when the raw body is missing', async () => {
    const req = {} as any;
    await expect(controller.stripeWebhook(req, 'sig')).rejects.toThrow(BadRequestException);
  });

  it('delegates to PaymentsService.handleStripeWebhook and acknowledges receipt', async () => {
    const req = { rawBody: Buffer.from('payload') } as any;
    const result = await controller.stripeWebhook(req, 'sig');
    expect(service.handleStripeWebhook).toHaveBeenCalledWith(req.rawBody, 'sig');
    expect(result).toEqual({ received: true });
  });
});
