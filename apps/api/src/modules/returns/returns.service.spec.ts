import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderStatus, ReturnStatus } from '@prisma/client';
import { ReturnsService } from './returns.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { Role } from '../../common/enums/role.enum';

type MockPrisma = {
  orderItem: { findUnique: jest.Mock };
  returnRequest: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
  payment: { updateMany: jest.Mock };
};

describe('ReturnsService', () => {
  let prisma: MockPrisma;
  let inventory: { restock: jest.Mock };
  let eventBus: { emit: jest.Mock };
  let service: ReturnsService;

  beforeEach(() => {
    prisma = {
      orderItem: { findUnique: jest.fn() },
      returnRequest: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      payment: { updateMany: jest.fn() },
    };
    inventory = { restock: jest.fn() };
    eventBus = { emit: jest.fn() };
    service = new ReturnsService(prisma as unknown as PrismaService, inventory as unknown as InventoryService, eventBus as unknown as EventBusService);
  });

  describe('create', () => {
    it('throws NotFoundException for a nonexistent order item', async () => {
      prisma.orderItem.findUnique.mockResolvedValue(null);
      await expect(service.create('u1', { orderItemId: 'oi1', reason: 'x' } as any)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the order belongs to a different customer', async () => {
      prisma.orderItem.findUnique.mockResolvedValue({
        order: { userId: 'someone-else', status: OrderStatus.DELIVERED, user: {} },
        returnRequest: null,
      });
      await expect(service.create('u1', { orderItemId: 'oi1', reason: 'x' } as any)).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when the order is not yet DELIVERED', async () => {
      prisma.orderItem.findUnique.mockResolvedValue({
        order: { userId: 'u1', status: OrderStatus.SHIPPED, user: {} },
        returnRequest: null,
      });
      await expect(service.create('u1', { orderItemId: 'oi1', reason: 'x' } as any)).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when this item already has a return request', async () => {
      prisma.orderItem.findUnique.mockResolvedValue({
        order: { userId: 'u1', status: OrderStatus.DELIVERED, user: {} },
        returnRequest: { id: 'existing' },
      });
      await expect(service.create('u1', { orderItemId: 'oi1', reason: 'x' } as any)).rejects.toThrow(ConflictException);
    });

    it('creates the return request and emits return.requested with the customer email', async () => {
      prisma.orderItem.findUnique.mockResolvedValue({
        order: { userId: 'u1', status: OrderStatus.DELIVERED, user: { email: 'a@b.com' } },
        returnRequest: null,
        productNameSnapshot: 'Gold Ring',
      });
      prisma.returnRequest.create.mockResolvedValue({ id: 'r1' });

      await service.create('u1', { orderItemId: 'oi1', reason: 'wrong size' } as any);

      expect(eventBus.emit).toHaveBeenCalledWith('return.requested', {
        returnId: 'r1',
        userEmail: 'a@b.com',
        productName: 'Gold Ring',
      });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for a nonexistent return', async () => {
      prisma.returnRequest.findUnique.mockResolvedValue(null);
      await expect(service.findOne('r1', { userId: 'u1', role: Role.CUSTOMER })).rejects.toThrow(NotFoundException);
    });

    it('allows the owning customer to view their own return', async () => {
      const rr = { orderItem: { order: { userId: 'u1' } } };
      prisma.returnRequest.findUnique.mockResolvedValue(rr);
      expect(await service.findOne('r1', { userId: 'u1', role: Role.CUSTOMER })).toBe(rr);
    });

    it('throws ForbiddenException for a different customer', async () => {
      const rr = { orderItem: { order: { userId: 'owner' } } };
      prisma.returnRequest.findUnique.mockResolvedValue(rr);
      await expect(service.findOne('r1', { userId: 'intruder', role: Role.CUSTOMER })).rejects.toThrow(ForbiddenException);
    });

    it('allows STAFF to view any return', async () => {
      const rr = { orderItem: { order: { userId: 'owner' } } };
      prisma.returnRequest.findUnique.mockResolvedValue(rr);
      expect(await service.findOne('r1', { userId: 'staff-1', role: Role.STAFF })).toBe(rr);
    });
  });

  describe('findForUser', () => {
    it('scopes the query to the requesting user’s own orders only', async () => {
      prisma.returnRequest.findMany.mockResolvedValue([]);
      await service.findForUser('u1');
      expect(prisma.returnRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orderItem: { order: { userId: 'u1' } } } }),
      );
    });
  });

  describe('adminFindAll', () => {
    it('filters by status when one is provided', async () => {
      prisma.returnRequest.findMany.mockResolvedValue([]);
      await service.adminFindAll({ page: 1, pageSize: 10 }, 'APPROVED' as any);
      expect(prisma.returnRequest.findMany.mock.calls[0][0].where).toEqual({ status: 'APPROVED' });
    });

    it('returns all statuses when none is specified', async () => {
      prisma.returnRequest.findMany.mockResolvedValue([]);
      await service.adminFindAll({ page: 1, pageSize: 10 });
      expect(prisma.returnRequest.findMany.mock.calls[0][0].where).toBeUndefined();
    });
  });

  describe('adminUpdateStatus', () => {
    it('throws NotFoundException for a nonexistent return', async () => {
      prisma.returnRequest.findUnique.mockResolvedValue(null);
      await expect(service.adminUpdateStatus('r1', ReturnStatus.APPROVED)).rejects.toThrow(NotFoundException);
    });

    it('rejects an illegal transition, e.g. REQUESTED -> REFUNDED (skipping APPROVED)', async () => {
      prisma.returnRequest.findUnique.mockResolvedValue({ status: ReturnStatus.REQUESTED });
      await expect(service.adminUpdateStatus('r1', ReturnStatus.REFUNDED, 1000)).rejects.toThrow(BadRequestException);
    });

    it('rejects marking REFUNDED without a refundAmountMinorUnits', async () => {
      prisma.returnRequest.findUnique.mockResolvedValue({ status: ReturnStatus.REFUND_PROCESSING });
      await expect(service.adminUpdateStatus('r1', ReturnStatus.REFUNDED)).rejects.toThrow(BadRequestException);
    });

    it('allows REQUESTED -> APPROVED with no inventory/payment side effects', async () => {
      prisma.returnRequest.findUnique.mockResolvedValue({ status: ReturnStatus.REQUESTED });
      prisma.returnRequest.update.mockResolvedValue({ id: 'r1', status: ReturnStatus.APPROVED });
      await service.adminUpdateStatus('r1', ReturnStatus.APPROVED);
      expect(inventory.restock).not.toHaveBeenCalled();
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    });

    it('restocks inventory and marks the payment REFUNDED when transitioning to REFUNDED', async () => {
      prisma.returnRequest.findUnique.mockResolvedValue({
        status: ReturnStatus.REFUND_PROCESSING,
        orderItem: { variantId: 'v1', quantity: 2, orderId: 'o1' },
      });
      prisma.returnRequest.update.mockResolvedValue({
        id: 'r1',
        orderItem: { order: { user: { email: 'a@b.com' } } },
      });

      await service.adminUpdateStatus('r1', ReturnStatus.REFUNDED, 5000);

      expect(inventory.restock).toHaveBeenCalledWith('v1', 2);
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { orderId: 'o1' },
        data: { status: 'REFUNDED' },
      });
    });

    it('emits return.refunded with the refund amount only when transitioning to REFUNDED', async () => {
      prisma.returnRequest.findUnique.mockResolvedValue({
        status: ReturnStatus.REFUND_PROCESSING,
        orderItem: { variantId: 'v1', quantity: 1, orderId: 'o1' },
      });
      prisma.returnRequest.update.mockResolvedValue({
        id: 'r1',
        orderItem: { order: { user: { email: 'a@b.com' } } },
      });

      await service.adminUpdateStatus('r1', ReturnStatus.REFUNDED, 7500);

      expect(eventBus.emit).toHaveBeenCalledWith('return.refunded', {
        returnId: 'r1',
        userEmail: 'a@b.com',
        refundAmountMinorUnits: 7500,
      });
    });

    it('does not emit return.refunded for a non-REFUNDED transition', async () => {
      prisma.returnRequest.findUnique.mockResolvedValue({ status: ReturnStatus.REQUESTED });
      prisma.returnRequest.update.mockResolvedValue({ id: 'r1' });
      await service.adminUpdateStatus('r1', ReturnStatus.APPROVED);
      expect(eventBus.emit).not.toHaveBeenCalled();
    });
  });
});
