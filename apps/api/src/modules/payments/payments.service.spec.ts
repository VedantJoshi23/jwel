import { BadRequestException } from '@nestjs/common';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { EventBusService } from '../../common/event-bus/event-bus.service';

type MockPrisma = {
  payment: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
};

describe('PaymentsService', () => {
  let prisma: MockPrisma;
  let stripeProvider: { createPaymentIntent: jest.Mock; parseWebhookEvent: jest.Mock };
  let razorpayProvider: { createPaymentIntent: jest.Mock };
  let eventBus: { emit: jest.Mock };
  let service: PaymentsService;

  beforeEach(() => {
    prisma = {
      payment: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    };
    stripeProvider = { createPaymentIntent: jest.fn(), parseWebhookEvent: jest.fn() };
    razorpayProvider = { createPaymentIntent: jest.fn() };
    eventBus = { emit: jest.fn() };
    service = new PaymentsService(
      prisma as unknown as PrismaService,
      stripeProvider as any,
      razorpayProvider as any,
      eventBus as unknown as EventBusService,
    );
  });

  describe('initiateForOrder', () => {
    it('routes to the Stripe adapter for PaymentProvider.STRIPE', async () => {
      stripeProvider.createPaymentIntent.mockResolvedValue({ providerRef: 'pi_1', clientSecret: 'secret_1' });
      prisma.payment.create.mockResolvedValue({ id: 'pay_1' });

      const result = await service.initiateForOrder('o1', 5000, PaymentProvider.STRIPE);

      expect(stripeProvider.createPaymentIntent).toHaveBeenCalledWith({ orderId: 'o1', amountMinorUnits: 5000, currency: 'INR' });
      expect(razorpayProvider.createPaymentIntent).not.toHaveBeenCalled();
      expect(result.clientSecret).toBe('secret_1');
    });

    it('routes to the Razorpay adapter for PaymentProvider.RAZORPAY', async () => {
      razorpayProvider.createPaymentIntent.mockResolvedValue({ providerRef: 'rp_1', clientSecret: 'secret_2' });
      prisma.payment.create.mockResolvedValue({ id: 'pay_1' });

      await service.initiateForOrder('o1', 5000, PaymentProvider.RAZORPAY);

      expect(razorpayProvider.createPaymentIntent).toHaveBeenCalled();
      expect(stripeProvider.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('persists the payment as PENDING with the provider reference', async () => {
      stripeProvider.createPaymentIntent.mockResolvedValue({ providerRef: 'pi_1', clientSecret: 'secret_1' });
      prisma.payment.create.mockResolvedValue({ id: 'pay_1' });

      await service.initiateForOrder('o1', 5000, PaymentProvider.STRIPE);

      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: { orderId: 'o1', provider: PaymentProvider.STRIPE, status: PaymentStatus.PENDING, amountMinorUnits: 5000, providerRef: 'pi_1' },
      });
    });
  });

  describe('handleStripeWebhook', () => {
    it('marks the payment SUCCEEDED and emits payment.succeeded for payment_intent.succeeded, without touching Order', async () => {
      stripeProvider.parseWebhookEvent.mockReturnValue({ kind: 'succeeded', providerRef: 'pi_1' });
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay_1',
        orderId: 'o1',
        status: PaymentStatus.PENDING,
        amountMinorUnits: 5000,
      });

      await service.handleStripeWebhook(Buffer.from(''), 'sig');

      expect(prisma.payment.update).toHaveBeenCalledWith({ where: { id: 'pay_1' }, data: { status: PaymentStatus.SUCCEEDED } });
      expect(eventBus.emit).toHaveBeenCalledWith('payment.succeeded', { orderId: 'o1', amountMinorUnits: 5000 });
    });

    it('is idempotent — a webhook replay for an already-SUCCEEDED payment does nothing', async () => {
      stripeProvider.parseWebhookEvent.mockReturnValue({ kind: 'succeeded', providerRef: 'pi_1' });
      prisma.payment.findUnique.mockResolvedValue({ id: 'pay_1', status: PaymentStatus.SUCCEEDED });

      await service.handleStripeWebhook(Buffer.from(''), 'sig');

      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    it('marks the payment FAILED for payment_intent.payment_failed', async () => {
      stripeProvider.parseWebhookEvent.mockReturnValue({ kind: 'failed', providerRef: 'pi_1' });
      prisma.payment.findUnique.mockResolvedValue({ id: 'pay_1', status: PaymentStatus.PENDING });

      await service.handleStripeWebhook(Buffer.from(''), 'sig');

      expect(prisma.payment.update).toHaveBeenCalledWith({ where: { id: 'pay_1' }, data: { status: PaymentStatus.FAILED } });
    });

    it('does nothing for an unrecognized event type', async () => {
      stripeProvider.parseWebhookEvent.mockReturnValue({ kind: 'ignored', description: 'charge.dispute.created' });
      await service.handleStripeWebhook(Buffer.from(''), 'sig');
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    it('does nothing when the webhook references a payment that does not exist locally', async () => {
      stripeProvider.parseWebhookEvent.mockReturnValue({ kind: 'succeeded', providerRef: 'unknown' });
      prisma.payment.findUnique.mockResolvedValue(null);
      await expect(service.handleStripeWebhook(Buffer.from(''), 'sig')).resolves.toBeUndefined();
    });
  });

  it('throws BadRequestException for an unsupported payment provider', async () => {
    await expect(service.initiateForOrder('o1', 5000, 'BITCOIN' as PaymentProvider)).rejects.toThrow(
      BadRequestException,
    );
  });

  describe('markFailed', () => {
    it('leaves an already-SUCCEEDED payment alone so a late failure cannot undo a capture', async () => {
      stripeProvider.parseWebhookEvent.mockReturnValue({ kind: 'failed', providerRef: 'pi_1' });
      prisma.payment.findUnique.mockResolvedValue({ id: 'pay_1', status: PaymentStatus.SUCCEEDED });

      await service.handleStripeWebhook(Buffer.from(''), 'sig');

      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('does nothing when the failed webhook references an unknown payment', async () => {
      stripeProvider.parseWebhookEvent.mockReturnValue({ kind: 'failed', providerRef: 'unknown' });
      prisma.payment.findUnique.mockResolvedValue(null);

      await service.handleStripeWebhook(Buffer.from(''), 'sig');

      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });

  describe('markRefunded', () => {
    it('marks every payment row for the order REFUNDED', async () => {
      prisma.payment.updateMany.mockResolvedValue({ count: 1 });

      await service.markRefunded('o1');

      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { orderId: 'o1' },
        data: { status: PaymentStatus.REFUNDED },
      });
    });
  });

  describe('mock provider self-confirmation', () => {
    // The mock has no webhook to wait for, so initiateForOrder confirms
    // inline. Real adapters must NOT take this path — a payment may only
    // become SUCCEEDED via a signed webhook.
    it('self-confirms immediately when the adapter is the mock', async () => {
      const mock = new MockPaymentProvider();
      jest.spyOn(mock, 'createPaymentIntent').mockResolvedValue({
        providerRef: 'mock_1',
        clientSecret: 'mock_secret_1',
      });
      const mockService = new PaymentsService(
        prisma as unknown as PrismaService,
        mock as any,
        razorpayProvider as any,
        eventBus as unknown as EventBusService,
      );
      prisma.payment.create.mockResolvedValue({ id: 'pay_1' });
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay_1',
        orderId: 'o1',
        status: PaymentStatus.PENDING,
        amountMinorUnits: 5000,
      });

      await mockService.initiateForOrder('o1', 5000, PaymentProvider.STRIPE);

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay_1' },
        data: { status: PaymentStatus.SUCCEEDED },
      });
    });

    it('does not self-confirm for a real adapter', async () => {
      stripeProvider.createPaymentIntent.mockResolvedValue({
        providerRef: 'pi_1',
        clientSecret: 'secret_1',
      });
      prisma.payment.create.mockResolvedValue({ id: 'pay_1' });

      await service.initiateForOrder('o1', 5000, PaymentProvider.STRIPE);

      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });
});
