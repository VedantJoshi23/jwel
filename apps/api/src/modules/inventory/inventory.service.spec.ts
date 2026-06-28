import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../prisma/prisma.service';

type MockPrisma = {
  inventory: { findUnique: jest.Mock; update: jest.Mock };
  $executeRaw: jest.Mock;
  $queryRaw: jest.Mock;
};

describe('InventoryService', () => {
  let prisma: MockPrisma;
  let service: InventoryService;

  beforeEach(() => {
    prisma = {
      inventory: { findUnique: jest.fn(), update: jest.fn() },
      $executeRaw: jest.fn(),
      $queryRaw: jest.fn(),
    };
    service = new InventoryService(prisma as unknown as PrismaService);
  });

  describe('getByVariant', () => {
    it('returns the inventory record when found', async () => {
      const item = { variantId: 'v1', quantityOnHand: 10, quantityReserved: 2 };
      prisma.inventory.findUnique.mockResolvedValue(item);
      expect(await service.getByVariant('v1')).toBe(item);
    });

    it('throws NotFoundException when no inventory record exists for the variant', async () => {
      prisma.inventory.findUnique.mockResolvedValue(null);
      await expect(service.getByVariant('v1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reserve', () => {
    it('rejects a non-positive quantity before touching the database', async () => {
      await expect(service.reserve('v1', 0)).rejects.toThrow(BadRequestException);
      await expect(service.reserve('v1', -1)).rejects.toThrow(BadRequestException);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('succeeds when the conditional UPDATE affects a row (stock was available)', async () => {
      prisma.$executeRaw.mockResolvedValue(1);
      await expect(service.reserve('v1', 3)).resolves.toBeUndefined();
    });

    it('throws ConflictException when the conditional UPDATE affects zero rows (insufficient stock)', async () => {
      prisma.$executeRaw.mockResolvedValue(0);
      await expect(service.reserve('v1', 3)).rejects.toThrow(ConflictException);
    });
  });

  describe('adminAdjust', () => {
    it('increments on-hand stock via a positive delta using a plain update', async () => {
      prisma.inventory.findUnique.mockResolvedValue({ variantId: 'v1', quantityOnHand: 5, quantityReserved: 0 });
      prisma.inventory.update.mockResolvedValue({});
      await service.adminAdjust('v1', 5);
      expect(prisma.inventory.update).toHaveBeenCalledWith({
        where: { variantId: 'v1' },
        data: { quantityOnHand: { increment: 5 } },
      });
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('decrements on-hand stock via a conditional raw UPDATE for a negative delta', async () => {
      prisma.inventory.findUnique.mockResolvedValue({ variantId: 'v1', quantityOnHand: 10, quantityReserved: 0 });
      prisma.$executeRaw.mockResolvedValue(1);
      await service.adminAdjust('v1', -3);
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('throws ConflictException when a negative delta would drop on-hand below reserved', async () => {
      prisma.inventory.findUnique.mockResolvedValue({ variantId: 'v1', quantityOnHand: 5, quantityReserved: 4 });
      prisma.$executeRaw.mockResolvedValue(0);
      await expect(service.adminAdjust('v1', -3)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException up-front when the variant has no inventory record', async () => {
      prisma.inventory.findUnique.mockResolvedValue(null);
      await expect(service.adminAdjust('missing', 5)).rejects.toThrow(NotFoundException);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      expect(prisma.inventory.update).not.toHaveBeenCalled();
    });
  });

  describe('release / commit / restock', () => {
    it('release issues a raw UPDATE and never throws even if zero rows match', async () => {
      prisma.$executeRaw.mockResolvedValue(0);
      await expect(service.release('v1', 2)).resolves.toBeUndefined();
    });

    it('commit issues a raw UPDATE', async () => {
      prisma.$executeRaw.mockResolvedValue(1);
      await expect(service.commit('v1', 2)).resolves.toBeUndefined();
    });

    it('restock issues a raw UPDATE', async () => {
      prisma.$executeRaw.mockResolvedValue(1);
      await expect(service.restock('v1', 10)).resolves.toBeUndefined();
    });
  });

  describe('listLowStock', () => {
    it('delegates to a raw query and returns its result', async () => {
      const rows = [{ variantId: 'v1', quantityOnHand: 1, quantityReserved: 0, lowStockThreshold: 5 }];
      prisma.$queryRaw.mockResolvedValue(rows);
      expect(await service.listLowStock()).toBe(rows);
    });
  });
});
