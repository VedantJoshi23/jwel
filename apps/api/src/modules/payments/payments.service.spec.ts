import { BadRequestException } from '@nestjs/common';
import { PaymentProvider, PaymentStatus, OrderStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { StripePaymentProvider } from './providers/stripe-payment.provider';

type MockPrisma = {
  payment: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  order: { update: jest.Mock };
  orderStatusHistory: { create: jest.Mock };
  $transaction: jest.Mock;
};

describe('PaymentsService', () => {
  let prisma: MockPrisma;
  let stripeProvider: { createPaymentIntent: jest.Mock };
  let razorpayProvider: { createPaymentIntent: jest.Mock };
  let stripe: { constructEvent: jest.Mock };
  let eventBus: { emit: jest.Mock };
  let service: PaymentsService;

  beforeEach(() => {
    prisma = {
      payment: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      order: { update: jest.fn() },
      orderStatusHistory: { create: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    stripeProvider = { createPaymentIntent: jest.fn() };
    razorpayProvider = { createPaymentIntent: jest.fn() };
    stripe = { constructEvent: jest.fn() };
    eventBus = { emit: jest.fn() };
    service = new PaymentsService(
      prisma as unknown as PrismaService,
      stripeProvider as any,
      razorpayProvider as any,
      stripe as unknown as StripePaymentProvider,
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
    it('marks the payment SUCCEEDED, confirms the order, and emits order.confirmed for payment_intent.succeeded', async () => {
      stripe.constructEvent.mockReturnValue({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_1' } } });
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay_1',
        orderId: 'o1',
        status: PaymentStatus.PENDING,
        amountMinorUnits: 5000,
        order: { user: { email: 'a@b.com' } },
      });

      await service.handleStripeWebhook(Buffer.from(''), 'sig');

      expect(prisma.order.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { status: OrderStatus.CONFIRMED } });
      expect(eventBus.emit).toHaveBeenCalledWith('order.confirmed', { orderId: 'o1', userEmail: 'a@b.com', totalMinorUnits: 5000 });
    });

    it('is idempotent — a webhook replay for an already-SUCCEEDED payment does nothing', async () => {
      stripe.constructEvent.mockReturnValue({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_1' } } });
      prisma.payment.findUnique.mockResolvedValue({ id: 'pay_1', status: PaymentStatus.SUCCEEDED });

      await service.handleStripeWebhook(Buffer.from(''), 'sig');

      expect(prisma.order.update).not.toHaveBeenCalled();
      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    it('marks the payment FAILED for payment_intent.payment_failed', async () => {
      stripe.constructEvent.mockReturnValue({ type: 'payment_intent.payment_failed', data: { object: { id: 'pi_1' } } });
      prisma.payment.findUnique.mockResolvedValue({ id: 'pay_1', status: PaymentStatus.PENDING });

      await service.handleStripeWebhook(Buffer.from(''), 'sig');

      expect(prisma.payment.update).toHaveBeenCalledWith({ where: { id: 'pay_1' }, data: { status: PaymentStatus.FAILED } });
    });

    it('does nothing for an unrecognized event type', async () => {
      stripe.constructEvent.mockReturnValue({ type: 'charge.dispute.created', data: { object: {} } });
      await service.handleStripeWebhook(Buffer.from(''), 'sig');
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('does nothing when the webhook references a payment that does not exist locally', async () => {
      stripe.constructEvent.mockReturnValue({ type: 'payment_intent.succeeded', data: { object: { id: 'unknown' } } });
      prisma.payment.findUnique.mockResolvedValue(null);
      await expect(service.handleStripeWebhook(Buffer.from(''), 'sig')).resolves.toBeUndefined();
    });
  });

  it('throws BadRequestException for an unsupported payment provider', async () => {
    await expect(service.initiateForOrder('o1', 5000, 'BITCOIN' as PaymentProvider)).rejects.toThrow(
      BadRequestException,
    );
  });
});
