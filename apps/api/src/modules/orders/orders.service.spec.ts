import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentProvider, ProductStatus } from '@prisma/client';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CouponsService } from '../coupons/coupons.service';
import { PaymentsService } from '../payments/payments.service';
import { Role } from '../../common/enums/role.enum';

type MockPrisma = {
  order: { findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock; count: jest.Mock };
  productVariant: { findMany: jest.Mock };
  $transaction: jest.Mock;
};

function fakeVariant(id: string, basePriceMinorUnits: number, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    basePriceMinorUnits,
    metal: 'GOLD',
    purity: '18K',
    size: null,
    product: { name: `Product for ${id}`, status: ProductStatus.PUBLISHED, deletedAt: null },
    ...overrides,
  };
}

describe('OrdersService', () => {
  let prisma: MockPrisma;
  let inventory: { commit: jest.Mock; release: jest.Mock; reserve: jest.Mock };
  let coupons: { validate: jest.Mock; redeem: jest.Mock };
  let payments: { initiateForOrder: jest.Mock };
  let service: OrdersService;
  let tx: { order: { create: jest.Mock; update: jest.Mock } };

  beforeEach(() => {
    tx = { order: { create: jest.fn(), update: jest.fn() } };
    prisma = {
      order: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      productVariant: { findMany: jest.fn() },
      $transaction: jest.fn((arg) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg))),
    };
    inventory = { commit: jest.fn(), release: jest.fn(), reserve: jest.fn() };
    coupons = { validate: jest.fn(), redeem: jest.fn() };
    payments = { initiateForOrder: jest.fn() };
    service = new OrdersService(
      prisma as unknown as PrismaService,
      inventory as unknown as InventoryService,
      coupons as unknown as CouponsService,
      payments as unknown as PaymentsService,
    );
  });

  describe('create', () => {
    it('throws BadRequestException when a referenced variant does not exist', async () => {
      prisma.productVariant.findMany.mockResolvedValue([]);
      await expect(
        service.create('u1', { items: [{ variantId: 'ghost', quantity: 1 }], shippingAddress: {} } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when a variant’s product is not PUBLISHED', async () => {
      prisma.productVariant.findMany.mockResolvedValue([
        fakeVariant('v1', 1000, { product: { name: 'X', status: ProductStatus.DRAFT, deletedAt: null } }),
      ]);
      await expect(
        service.create('u1', { items: [{ variantId: 'v1', quantity: 1 }], shippingAddress: {} } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('reserves stock for every line item inside the transaction', async () => {
      prisma.productVariant.findMany.mockResolvedValue([fakeVariant('v1', 1000)]);
      tx.order.create.mockResolvedValue({ id: 'o1', items: [] });
      payments.initiateForOrder.mockResolvedValue({ clientSecret: 'secret' });

      await service.create('u1', { items: [{ variantId: 'v1', quantity: 3 }], shippingAddress: {} } as any);

      expect(inventory.reserve).toHaveBeenCalledWith('v1', 3, tx);
    });

    it('computes the subtotal as the sum of variant price × quantity', async () => {
      prisma.productVariant.findMany.mockResolvedValue([fakeVariant('v1', 1000), fakeVariant('v2', 2000)]);
      tx.order.create.mockResolvedValue({ id: 'o1', items: [] });
      payments.initiateForOrder.mockResolvedValue({ clientSecret: 'secret' });

      await service.create('u1', {
        items: [{ variantId: 'v1', quantity: 2 }, { variantId: 'v2', quantity: 1 }],
        shippingAddress: {},
      } as any);

      // 1000*2 + 2000*1 = 4000
      expect(tx.order.create.mock.calls[0][0].data.subtotalMinorUnits).toBe(4000);
      expect(tx.order.create.mock.calls[0][0].data.totalMinorUnits).toBe(4000);
    });

    it('applies a coupon discount to the total and redeems it inside the same transaction', async () => {
      prisma.productVariant.findMany.mockResolvedValue([fakeVariant('v1', 10000)]);
      coupons.validate.mockResolvedValue({ discountMinorUnits: 1000, coupon: { id: 'coupon-1' } });
      tx.order.create.mockResolvedValue({ id: 'o1', items: [] });
      payments.initiateForOrder.mockResolvedValue({ clientSecret: 'secret' });

      await service.create('u1', {
        items: [{ variantId: 'v1', quantity: 1 }],
        shippingAddress: {},
        couponCode: 'SAVE10',
      } as any);

      expect(tx.order.create.mock.calls[0][0].data.totalMinorUnits).toBe(9000);
      expect(coupons.redeem).toHaveBeenCalledWith('coupon-1', 'o1', 'u1', tx);
    });

    it('initiates payment with the requested provider and returns the client secret', async () => {
      prisma.productVariant.findMany.mockResolvedValue([fakeVariant('v1', 1000)]);
      tx.order.create.mockResolvedValue({ id: 'o1', items: [] });
      payments.initiateForOrder.mockResolvedValue({ clientSecret: 'secret_abc' });

      const result = await service.create('u1', {
        items: [{ variantId: 'v1', quantity: 1 }],
        shippingAddress: {},
        paymentProvider: PaymentProvider.RAZORPAY,
      } as any);

      expect(payments.initiateForOrder).toHaveBeenCalledWith('o1', 1000, PaymentProvider.RAZORPAY);
      expect(result).toEqual({ orderId: 'o1', totalMinorUnits: 1000, clientSecret: 'secret_abc' });
    });

    it('defaults to STRIPE when no payment provider is specified', async () => {
      prisma.productVariant.findMany.mockResolvedValue([fakeVariant('v1', 1000)]);
      tx.order.create.mockResolvedValue({ id: 'o1', items: [] });
      payments.initiateForOrder.mockResolvedValue({ clientSecret: 'secret' });

      await service.create('u1', { items: [{ variantId: 'v1', quantity: 1 }], shippingAddress: {} } as any);

      expect(payments.initiateForOrder).toHaveBeenCalledWith('o1', 1000, PaymentProvider.STRIPE);
    });

    it('compensates (releases stock, cancels the order) and rethrows when payment initiation fails', async () => {
      prisma.productVariant.findMany.mockResolvedValue([fakeVariant('v1', 1000)]);
      tx.order.create.mockResolvedValue({ id: 'o1', items: [] });
      payments.initiateForOrder.mockRejectedValue(new Error('Stripe is down'));
      prisma.order.update.mockResolvedValue({});

      await expect(
        service.create('u1', { items: [{ variantId: 'v1', quantity: 2 }], shippingAddress: {} } as any),
      ).rejects.toThrow('Stripe is down');

      expect(inventory.release).toHaveBeenCalledWith('v1', 2);
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: expect.objectContaining({ status: OrderStatus.CANCELLED }),
      });
    });
  });

  describe('findForUser', () => {
    it('scopes the query to the requesting user only', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(0);
      await service.findForUser('u1', { page: 1, pageSize: 10 });
      expect(prisma.order.findMany.mock.calls[0][0].where).toEqual({ userId: 'u1' });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for a nonexistent order', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.findOne('o1', { userId: 'u1', role: Role.CUSTOMER })).rejects.toThrow(NotFoundException);
    });

    it('returns the order to its owner', async () => {
      const order = { id: 'o1', userId: 'u1' };
      prisma.order.findUnique.mockResolvedValue(order);
      expect(await service.findOne('o1', { userId: 'u1', role: Role.CUSTOMER })).toBe(order);
    });

    it('returns the order to STAFF even when they are not the owner', async () => {
      const order = { id: 'o1', userId: 'someone-else' };
      prisma.order.findUnique.mockResolvedValue(order);
      expect(await service.findOne('o1', { userId: 'staff-1', role: Role.STAFF })).toBe(order);
    });

    it('returns the order to ADMIN even when they are not the owner', async () => {
      const order = { id: 'o1', userId: 'someone-else' };
      prisma.order.findUnique.mockResolvedValue(order);
      expect(await service.findOne('o1', { userId: 'admin-1', role: Role.ADMIN })).toBe(order);
    });

    it('throws ForbiddenException for a different CUSTOMER trying to view someone else’s order', async () => {
      const order = { id: 'o1', userId: 'owner' };
      prisma.order.findUnique.mockResolvedValue(order);
      await expect(service.findOne('o1', { userId: 'intruder', role: Role.CUSTOMER })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('adminUpdateStatus', () => {
    it('throws NotFoundException for a nonexistent order', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.adminUpdateStatus('o1', OrderStatus.CONFIRMED)).rejects.toThrow(NotFoundException);
    });

    it('allows PLACED -> CONFIRMED', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: OrderStatus.PLACED, items: [] });
      prisma.order.update.mockResolvedValue({ id: 'o1', status: OrderStatus.CONFIRMED });
      await expect(service.adminUpdateStatus('o1', OrderStatus.CONFIRMED)).resolves.toBeDefined();
    });

    it('rejects an illegal transition, e.g. PLACED -> DELIVERED (skipping intermediate states)', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: OrderStatus.PLACED, items: [] });
      await expect(service.adminUpdateStatus('o1', OrderStatus.DELIVERED)).rejects.toThrow(BadRequestException);
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('rejects any transition out of a terminal state (DELIVERED)', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: OrderStatus.DELIVERED, items: [] });
      await expect(service.adminUpdateStatus('o1', OrderStatus.CANCELLED)).rejects.toThrow(BadRequestException);
    });

    it('commits inventory (decrements on-hand) when transitioning to SHIPPED', async () => {
      const items = [{ variantId: 'v1', quantity: 2 }, { variantId: 'v2', quantity: 1 }];
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: OrderStatus.PROCESSING, items });
      prisma.order.update.mockResolvedValue({ id: 'o1', status: OrderStatus.SHIPPED });

      await service.adminUpdateStatus('o1', OrderStatus.SHIPPED);

      expect(inventory.commit).toHaveBeenCalledWith('v1', 2);
      expect(inventory.commit).toHaveBeenCalledWith('v2', 1);
      expect(inventory.release).not.toHaveBeenCalled();
    });

    it('releases reserved inventory when transitioning to CANCELLED', async () => {
      const items = [{ variantId: 'v1', quantity: 3 }];
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: OrderStatus.CONFIRMED, items });
      prisma.order.update.mockResolvedValue({ id: 'o1', status: OrderStatus.CANCELLED });

      await service.adminUpdateStatus('o1', OrderStatus.CANCELLED);

      expect(inventory.release).toHaveBeenCalledWith('v1', 3);
      expect(inventory.commit).not.toHaveBeenCalled();
    });

    it('does not touch inventory for a CONFIRMED transition (no commit/release expected)', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: OrderStatus.PLACED, items: [{ variantId: 'v1', quantity: 1 }] });
      prisma.order.update.mockResolvedValue({ id: 'o1', status: OrderStatus.CONFIRMED });

      await service.adminUpdateStatus('o1', OrderStatus.CONFIRMED);

      expect(inventory.commit).not.toHaveBeenCalled();
      expect(inventory.release).not.toHaveBeenCalled();
    });

    it('records the optional note in the status history write', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: OrderStatus.PLACED, items: [] });
      prisma.order.update.mockResolvedValue({ id: 'o1', status: OrderStatus.CONFIRMED });

      await service.adminUpdateStatus('o1', OrderStatus.CONFIRMED, 'payment verified manually');

      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            statusHistory: { create: { status: OrderStatus.CONFIRMED, note: 'payment verified manually' } },
          }),
        }),
      );
    });
  });
});
