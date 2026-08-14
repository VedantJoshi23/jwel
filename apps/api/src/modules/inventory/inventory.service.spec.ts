import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

type MockPrisma = {
  inventory: { findUnique: jest.Mock; update: jest.Mock };
  $executeRaw: jest.Mock;
  $queryRaw: jest.Mock;
};

const actor: AuthenticatedUser = { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' };

describe('InventoryService', () => {
  let prisma: MockPrisma;
  let auditLog: { record: jest.Mock };
  let service: InventoryService;

  beforeEach(() => {
    prisma = {
      inventory: { findUnique: jest.fn(), update: jest.fn() },
      $executeRaw: jest.fn(),
      $queryRaw: jest.fn(),
    };
    auditLog = { record: jest.fn() };
    service = new InventoryService(prisma as unknown as PrismaService, auditLog as unknown as AuditLogService);
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
      await service.adminAdjust('v1', 5, actor);
      expect(prisma.inventory.update).toHaveBeenCalledWith({
        where: { variantId: 'v1' },
        data: { quantityOnHand: { increment: 5 } },
      });
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ actor, action: 'inventory.adjusted', entityType: 'Inventory', entityId: 'v1' }),
      );
    });

    it('decrements on-hand stock via a conditional raw UPDATE for a negative delta', async () => {
      prisma.inventory.findUnique.mockResolvedValue({ variantId: 'v1', quantityOnHand: 10, quantityReserved: 0 });
      prisma.$executeRaw.mockResolvedValue(1);
      await service.adminAdjust('v1', -3, actor);
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('throws ConflictException when a negative delta would drop on-hand below reserved', async () => {
      prisma.inventory.findUnique.mockResolvedValue({ variantId: 'v1', quantityOnHand: 5, quantityReserved: 4 });
      prisma.$executeRaw.mockResolvedValue(0);
      await expect(service.adminAdjust('v1', -3, actor)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException up-front when the variant has no inventory record', async () => {
      prisma.inventory.findUnique.mockResolvedValue(null);
      await expect(service.adminAdjust('missing', 5, actor)).rejects.toThrow(NotFoundException);
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

  describe('listInventory', () => {
    // Regression: the admin Inventory page previously only ever showed
    // low-stock rows, so an item that had already been restocked above its
    // threshold had no path back into view — this is the general-purpose
    // list that fixes it.
    it('returns a paginated, joined result regardless of stock level', async () => {
      const rows = [
        {
          variantId: 'v1',
          quantityOnHand: 10,
          quantityReserved: 0,
          lowStockThreshold: 5,
          sku: 'SKU-1',
          productName: 'Gold Ring',
          productSlug: 'gold-ring',
        },
      ];
      prisma.$queryRaw.mockResolvedValueOnce(rows).mockResolvedValueOnce([{ count: 1n }]);

      const result = await service.listInventory({ page: 1, pageSize: 24 });
      expect(result).toEqual({ items: rows, page: 1, pageSize: 24, total: 1 });
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('builds the same WHERE fragment once and reuses it for both the page query and the count query', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }]);
      await service.listInventory({ page: 1, pageSize: 24, q: 'ring', lowStockOnly: true });

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      // The interpolated `where` fragment is one of the tagged-template's
      // values (a `Prisma.Sql` object), not part of the static template
      // strings — its own `.sql` text is where the predicates actually live.
      const [itemsCall, countCall] = prisma.$queryRaw.mock.calls;
      const whereFragmentSql = (arg: unknown): string | undefined => (arg as { sql?: string })?.sql;
      const itemsWhere = itemsCall.map(whereFragmentSql).find((s: string | undefined) => s?.includes('ILIKE'));
      const countWhere = countCall.map(whereFragmentSql).find((s: string | undefined) => s?.includes('ILIKE'));
      expect(itemsWhere).toBeDefined();
      expect(itemsWhere).toContain('low_stock_threshold');
      expect(itemsWhere).toBe(countWhere);
    });

    it('returns an empty page with total 0 rather than throwing when nothing matches', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }]);
      const result = await service.listInventory({ page: 1, pageSize: 24, q: 'no-such-thing' });
      expect(result).toEqual({ items: [], page: 1, pageSize: 24, total: 0 });
    });
  });
});
