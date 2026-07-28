import { BadRequestException } from '@nestjs/common';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { EventBusService } from '../../common/event-bus/event-bus.service';

type MockPrisma = {
  payment: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
};

describe('PaymentsService', () => {
  let prisma: MockPrisma;
  let provider: {
    createPaymentIntent: jest.Mock;
    parseWebhookEvent: jest.Mock;
    verifyCheckoutResult: jest.Mock;
    refund: jest.Mock;
  };
  let eventBus: { emit: jest.Mock };
  let metrics: { paymentEventsTotal: { inc: jest.Mock } };
  let service: PaymentsService;

  beforeEach(() => {
    prisma = {
      payment: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    };
    provider = {
      createPaymentIntent: jest.fn(),
      parseWebhookEvent: jest.fn(),
      verifyCheckoutResult: jest.fn(),
      refund: jest.fn(),
    };
    eventBus = { emit: jest.fn() };
    metrics = { paymentEventsTotal: { inc: jest.fn() } };
    service = new PaymentsService(
      prisma as unknown as PrismaService,
      provider as any,
      eventBus as unknown as EventBusService,
      metrics as any,
    );
  });

  const intent = {
    providerRef: 'order_rzp1',
    checkout: { keyId: 'rzp_test_key', orderId: 'order_rzp1', simulated: false },
  };

  describe('initiateForOrder', () => {
    it('creates the gateway intent and returns only client-safe checkout values', async () => {
      provider.createPaymentIntent.mockResolvedValue(intent);
      prisma.payment.create.mockResolvedValue({ id: 'pay_1' });

      const result = await service.initiateForOrder('o1', 5000, PaymentProvider.RAZORPAY);

      expect(provider.createPaymentIntent).toHaveBeenCalledWith({
        orderId: 'o1',
        amountMinorUnits: 5000,
        currency: 'INR',
      });
      expect(result.checkout).toEqual({
        keyId: 'rzp_test_key',
        orderId: 'order_rzp1',
        simulated: false,
      });
      // The key secret must never reach a caller that serialises this to the
      // browser — the whole point of CheckoutHandle being a narrow type.
      expect(Object.keys(result.checkout)).toEqual(['keyId', 'orderId', 'simulated']);
    });

    it('persists the payment as PENDING with the provider reference', async () => {
      provider.createPaymentIntent.mockResolvedValue(intent);
      prisma.payment.create.mockResolvedValue({ id: 'pay_1' });

      await service.initiateForOrder('o1', 5000, PaymentProvider.RAZORPAY);

      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: {
          orderId: 'o1',
          provider: PaymentProvider.RAZORPAY,
          status: PaymentStatus.PENDING,
          amountMinorUnits: 5000,
          providerRef: 'order_rzp1',
        },
      });
    });

    // STRIPE survives in the Prisma enum (dropping an enum value costs a
    // migration for nothing) but has no adapter since ADR-0005. Naming it must
    // fail loudly rather than be silently routed at Razorpay.
    it('rejects PaymentProvider.STRIPE, which no longer has an adapter', async () => {
      await expect(service.initiateForOrder('o1', 5000, PaymentProvider.STRIPE)).rejects.toThrow(
        BadRequestException,
      );
      expect(provider.createPaymentIntent).not.toHaveBeenCalled();
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('rejects an unrecognised provider', async () => {
      await expect(
        service.initiateForOrder('o1', 5000, 'BITCOIN' as PaymentProvider),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleWebhook', () => {
    it('marks the payment SUCCEEDED and emits payment.succeeded, without touching Order', async () => {
      provider.parseWebhookEvent.mockReturnValue({ kind: 'succeeded', providerRef: 'order_rzp1' });
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay_1',
        orderId: 'o1',
        status: PaymentStatus.PENDING,
        amountMinorUnits: 5000,
      });

      await service.handleWebhook(Buffer.from(''), 'sig');

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay_1' },
        data: { status: PaymentStatus.SUCCEEDED },
      });
      expect(eventBus.emit).toHaveBeenCalledWith('payment.succeeded', {
        orderId: 'o1',
        amountMinorUnits: 5000,
      });
      expect(metrics.paymentEventsTotal.inc).toHaveBeenCalledWith({ outcome: 'succeeded' });
    });

    it('is idempotent — a webhook replay for an already-SUCCEEDED payment does nothing', async () => {
      provider.parseWebhookEvent.mockReturnValue({ kind: 'succeeded', providerRef: 'order_rzp1' });
      prisma.payment.findUnique.mockResolvedValue({ id: 'pay_1', status: PaymentStatus.SUCCEEDED });

      await service.handleWebhook(Buffer.from(''), 'sig');

      expect(eventBus.emit).not.toHaveBeenCalled();
      // The idempotency guard must suppress the metric too — a duplicated
      // delivery of the same real-world event must not be double-counted.
      expect(metrics.paymentEventsTotal.inc).not.toHaveBeenCalled();
    });

    it('marks the payment FAILED for payment.failed', async () => {
      provider.parseWebhookEvent.mockReturnValue({ kind: 'failed', providerRef: 'order_rzp1' });
      prisma.payment.findUnique.mockResolvedValue({ id: 'pay_1', status: PaymentStatus.PENDING });

      await service.handleWebhook(Buffer.from(''), 'sig');

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay_1' },
        data: { status: PaymentStatus.FAILED },
      });
      expect(metrics.paymentEventsTotal.inc).toHaveBeenCalledWith({ outcome: 'failed' });
    });

    it('does nothing for an unrecognized event type', async () => {
      provider.parseWebhookEvent.mockReturnValue({ kind: 'ignored', description: 'refund.created' });
      await service.handleWebhook(Buffer.from(''), 'sig');
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    it('does nothing when the webhook references a payment that does not exist locally', async () => {
      provider.parseWebhookEvent.mockReturnValue({ kind: 'succeeded', providerRef: 'unknown' });
      prisma.payment.findUnique.mockResolvedValue(null);
      await expect(service.handleWebhook(Buffer.from(''), 'sig')).resolves.toBeUndefined();
    });

    it('propagates a signature failure rather than swallowing it', async () => {
      provider.parseWebhookEvent.mockImplementation(() => {
        throw new BadRequestException('Invalid Razorpay webhook signature');
      });

      await expect(service.handleWebhook(Buffer.from('{}'), 'bad')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });

  describe('confirmFromCheckout', () => {
    const result = { providerRef: 'order_rzp1', paymentId: 'pay_rzp1', signature: 'sig' };

    it('marks the payment SUCCEEDED when the browser-supplied signature verifies', async () => {
      provider.verifyCheckoutResult.mockReturnValue({ kind: 'succeeded', providerRef: 'order_rzp1' });
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay_1',
        orderId: 'o1',
        status: PaymentStatus.PENDING,
        amountMinorUnits: 5000,
      });

      await service.confirmFromCheckout(result);

      expect(provider.verifyCheckoutResult).toHaveBeenCalledWith(result);
      expect(eventBus.emit).toHaveBeenCalledWith('payment.succeeded', {
        orderId: 'o1',
        amountMinorUnits: 5000,
      });
      expect(metrics.paymentEventsTotal.inc).toHaveBeenCalledWith({ outcome: 'succeeded' });
    });

    // The payload comes from a browser and is attacker-controllable. A forged
    // signature must never reach markSucceeded.
    it('propagates the adapter throw on a forged signature and writes nothing', async () => {
      provider.verifyCheckoutResult.mockImplementation(() => {
        throw new BadRequestException('Invalid Razorpay payment signature');
      });

      await expect(service.confirmFromCheckout(result)).rejects.toThrow(BadRequestException);
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    // Shares markSucceeded's guard, so verify racing the webhook is a no-op
    // rather than a double confirmation.
    it('is idempotent against a webhook that already confirmed the payment', async () => {
      provider.verifyCheckoutResult.mockReturnValue({ kind: 'succeeded', providerRef: 'order_rzp1' });
      prisma.payment.findUnique.mockResolvedValue({ id: 'pay_1', status: PaymentStatus.SUCCEEDED });

      await service.confirmFromCheckout(result);

      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(eventBus.emit).not.toHaveBeenCalled();
      expect(metrics.paymentEventsTotal.inc).not.toHaveBeenCalled();
    });

    it('marks the payment FAILED when the adapter reports a failed outcome', async () => {
      provider.verifyCheckoutResult.mockReturnValue({ kind: 'failed', providerRef: 'order_rzp1' });
      prisma.payment.findUnique.mockResolvedValue({ id: 'pay_1', status: PaymentStatus.PENDING });

      await service.confirmFromCheckout(result);

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay_1' },
        data: { status: PaymentStatus.FAILED },
      });
      expect(metrics.paymentEventsTotal.inc).toHaveBeenCalledWith({ outcome: 'failed' });
    });

    it('does nothing for an ignored outcome', async () => {
      provider.verifyCheckoutResult.mockReturnValue({ kind: 'ignored', description: 'noop' });

      await service.confirmFromCheckout(result);

      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });

  describe('markFailed', () => {
    it('leaves an already-SUCCEEDED payment alone so a late failure cannot undo a capture', async () => {
      provider.parseWebhookEvent.mockReturnValue({ kind: 'failed', providerRef: 'order_rzp1' });
      prisma.payment.findUnique.mockResolvedValue({ id: 'pay_1', status: PaymentStatus.SUCCEEDED });

      await service.handleWebhook(Buffer.from(''), 'sig');

      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('does nothing when the failed webhook references an unknown payment', async () => {
      provider.parseWebhookEvent.mockReturnValue({ kind: 'failed', providerRef: 'unknown' });
      prisma.payment.findUnique.mockResolvedValue(null);

      await service.handleWebhook(Buffer.from(''), 'sig');

      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });

  describe('refundForOrder', () => {
    const succeeded = {
      id: 'pay_1',
      orderId: 'o1',
      status: PaymentStatus.SUCCEEDED,
      providerRef: 'order_rzp1',
    };

    it('moves money at the gateway before marking the row REFUNDED', async () => {
      prisma.payment.findUnique.mockResolvedValue(succeeded);
      const callOrder: string[] = [];
      provider.refund.mockImplementation(async () => {
        callOrder.push('gateway');
        return { refundRef: 'rfnd_1' };
      });
      prisma.payment.update.mockImplementation(async () => {
        callOrder.push('db');
        return succeeded;
      });

      await service.refundForOrder('o1');

      expect(provider.refund).toHaveBeenCalledWith({
        providerRef: 'order_rzp1',
        amountMinorUnits: undefined,
      });
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay_1' },
        data: { status: PaymentStatus.REFUNDED },
      });
      // Ordering is the point: bookkeeping must never run ahead of the money.
      expect(callOrder).toEqual(['gateway', 'db']);
    });

    it('passes a partial amount through to the gateway', async () => {
      prisma.payment.findUnique.mockResolvedValue(succeeded);
      provider.refund.mockResolvedValue({ refundRef: 'rfnd_1' });

      await service.refundForOrder('o1', 2500);

      expect(provider.refund).toHaveBeenCalledWith({
        providerRef: 'order_rzp1',
        amountMinorUnits: 2500,
      });
    });

    // The critical failure mode: a Payment marked REFUNDED while the customer
    // never got their money.
    it('leaves the row untouched when the gateway refund fails', async () => {
      prisma.payment.findUnique.mockResolvedValue(succeeded);
      provider.refund.mockRejectedValue(new Error('gateway down'));

      await expect(service.refundForOrder('o1')).rejects.toThrow('gateway down');
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('does nothing when the order has no payment', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);

      await service.refundForOrder('o1');

      expect(provider.refund).not.toHaveBeenCalled();
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('refuses to refund a payment that never succeeded', async () => {
      prisma.payment.findUnique.mockResolvedValue({ ...succeeded, status: PaymentStatus.PENDING });

      await service.refundForOrder('o1');

      expect(provider.refund).not.toHaveBeenCalled();
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('refuses to refund a succeeded payment with no provider reference', async () => {
      prisma.payment.findUnique.mockResolvedValue({ ...succeeded, providerRef: null });

      await expect(service.refundForOrder('o1')).rejects.toThrow(BadRequestException);
      expect(provider.refund).not.toHaveBeenCalled();
    });
  });

  describe('mock provider self-confirmation', () => {
    // The mock has no webhook to wait for, so initiateForOrder confirms
    // inline. Real adapters must NOT take this path — a payment may only
    // become SUCCEEDED via a signed callback.
    it('self-confirms immediately when the adapter is the mock', async () => {
      const mock = new MockPaymentProvider();
      jest.spyOn(mock, 'createPaymentIntent').mockResolvedValue(intent);
      const mockService = new PaymentsService(
        prisma as unknown as PrismaService,
        mock as any,
        eventBus as unknown as EventBusService,
        metrics as any,
      );
      prisma.payment.create.mockResolvedValue({ id: 'pay_1' });
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay_1',
        orderId: 'o1',
        status: PaymentStatus.PENDING,
        amountMinorUnits: 5000,
      });

      await mockService.initiateForOrder('o1', 5000, PaymentProvider.RAZORPAY);

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay_1' },
        data: { status: PaymentStatus.SUCCEEDED },
      });
    });

    it('does not self-confirm for a real adapter', async () => {
      provider.createPaymentIntent.mockResolvedValue(intent);
      prisma.payment.create.mockResolvedValue({ id: 'pay_1' });

      await service.initiateForOrder('o1', 5000, PaymentProvider.RAZORPAY);

      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });
});
