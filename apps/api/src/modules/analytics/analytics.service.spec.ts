import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';

type MockPrisma = {
  order: { findMany: jest.Mock; groupBy: jest.Mock };
  orderItem: { findMany: jest.Mock };
  returnRequest: { aggregate: jest.Mock };
  review: { count: jest.Mock };
  user: { count: jest.Mock };
};

describe('AnalyticsService', () => {
  let prisma: MockPrisma;
  let inventory: { listLowStock: jest.Mock };
  let service: AnalyticsService;

  beforeEach(() => {
    prisma = {
      order: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
      orderItem: { findMany: jest.fn().mockResolvedValue([]) },
      returnRequest: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { refundAmountMinorUnits: null } }),
      },
      review: { count: jest.fn().mockResolvedValue(0) },
      user: { count: jest.fn().mockResolvedValue(0) },
    };
    inventory = { listLowStock: jest.fn().mockResolvedValue([]) };
    service = new AnalyticsService(prisma as unknown as PrismaService, inventory as unknown as InventoryService);
  });

  it('reports gross as the sum of order totals in the window', async () => {
    prisma.order.findMany.mockResolvedValue([{ totalMinorUnits: 10000 }, { totalMinorUnits: 25000 }]);
    const result = await service.getDashboardSummary(30);
    expect(result.grossMinorUnits).toBe(35000);
    expect(result.orderCount).toBe(2);
  });

  describe('refunds (DOM-REPORTING invariants 3 and 4)', () => {
    it('deducts refunds from gross to give net', async () => {
      prisma.order.findMany.mockResolvedValue([{ totalMinorUnits: 100000 }]);
      prisma.returnRequest.aggregate.mockResolvedValue({
        _sum: { refundAmountMinorUnits: 25000 },
      });

      const result = await service.getDashboardSummary(30);

      expect(result).toMatchObject({
        grossMinorUnits: 100000,
        refundsMinorUnits: 25000,
        netMinorUnits: 75000,
      });
    });

    it('counts only REFUNDED returns — money in flight has not moved (§8.5)', async () => {
      await service.getDashboardSummary(30);
      expect(prisma.returnRequest.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'REFUNDED' }) }),
      );
    });

    it('scopes refunds to the orders in the window, so the three figures describe one cohort', async () => {
      await service.getDashboardSummary(30);
      const where = prisma.returnRequest.aggregate.mock.calls[0][0].where;
      expect(where.orderItem.order).toMatchObject({
        createdAt: { gte: expect.any(Date) },
        status: { not: 'CANCELLED' },
      });
    });

    it('reports zero refunds rather than null when nothing was refunded', async () => {
      prisma.order.findMany.mockResolvedValue([{ totalMinorUnits: 100000 }]);
      const result = await service.getDashboardSummary(30);
      expect(result.refundsMinorUnits).toBe(0);
      expect(result.netMinorUnits).toBe(100000);
    });

    it('leaves AOV on gross — what a customer typically spends', async () => {
      prisma.order.findMany.mockResolvedValue([{ totalMinorUnits: 100000 }]);
      prisma.returnRequest.aggregate.mockResolvedValue({
        _sum: { refundAmountMinorUnits: 90000 },
      });

      const result = await service.getDashboardSummary(30);

      expect(result.averageOrderValueMinorUnits).toBe(100000);
    });
  });

  it('computes average order value as gross / orderCount, rounded', async () => {
    prisma.order.findMany.mockResolvedValue([{ totalMinorUnits: 10000 }, { totalMinorUnits: 10001 }]);
    const result = await service.getDashboardSummary(30);
    expect(result.averageOrderValueMinorUnits).toBe(10001); // round(20001/2) = round(10000.5) = 10001 (banker's-unaware Math.round)
  });

  it('returns 0 average order value when there are no orders (no division by zero)', async () => {
    prisma.order.findMany.mockResolvedValue([]);
    const result = await service.getDashboardSummary(30);
    expect(result.averageOrderValueMinorUnits).toBe(0);
  });

  it('maps groupBy results into an ordersByStatus record', async () => {
    prisma.order.groupBy.mockResolvedValue([
      { status: 'DELIVERED', _count: { _all: 3 } },
      { status: 'CANCELLED', _count: { _all: 1 } },
    ]);
    const result = await service.getDashboardSummary(30);
    expect(result.ordersByStatus).toEqual({ DELIVERED: 3, CANCELLED: 1 });
  });

  it('reports lowStockCount from InventoryService.listLowStock()', async () => {
    inventory.listLowStock.mockResolvedValue([{ a: 1 }, { a: 2 }, { a: 3 }]);
    const result = await service.getDashboardSummary(30);
    expect(result.lowStockCount).toBe(3);
  });

  it('passes the windowDays argument through to the response', async () => {
    const result = await service.getDashboardSummary(7);
    expect(result.windowDays).toBe(7);
  });

  describe('top products', () => {
    it('aggregates revenue/units per product across multiple order items for the same product', async () => {
      prisma.orderItem.findMany.mockResolvedValue([
        { quantity: 2, unitPriceMinorUnits: 1000, productNameSnapshot: 'Ring', variant: { productId: 'p1' } },
        { quantity: 1, unitPriceMinorUnits: 1000, productNameSnapshot: 'Ring', variant: { productId: 'p1' } },
        { quantity: 5, unitPriceMinorUnits: 500, productNameSnapshot: 'Chain', variant: { productId: 'p2' } },
      ]);
      const result = await service.getDashboardSummary(30);
      const ring = result.topProducts.find((p) => p.productId === 'p1');
      expect(ring).toEqual({
        productId: 'p1',
        name: 'Ring',
        unitsSold: 3,
        grossMinorUnits: 3000,
        refundsMinorUnits: 0,
        netMinorUnits: 3000,
      });
    });

    it('deducts a refunded item from its product’s contribution', async () => {
      prisma.orderItem.findMany.mockResolvedValue([
        {
          quantity: 1,
          unitPriceMinorUnits: 1000,
          productNameSnapshot: 'Ring',
          variant: { productId: 'p1' },
          returnRequest: { status: 'REFUNDED', refundAmountMinorUnits: 400 },
        },
      ]);

      const [ring] = (await service.getDashboardSummary(30)).topProducts;

      expect(ring).toMatchObject({ grossMinorUnits: 1000, refundsMinorUnits: 400, netMinorUnits: 600 });
      // Units sold is what left the shelf. Deducting here would conflate how
      // much moved with how much stayed sold.
      expect(ring.unitsSold).toBe(1);
    });

    it('ignores a return that has not been refunded yet', async () => {
      prisma.orderItem.findMany.mockResolvedValue([
        {
          quantity: 1,
          unitPriceMinorUnits: 1000,
          productNameSnapshot: 'Ring',
          variant: { productId: 'p1' },
          returnRequest: { status: 'APPROVED', refundAmountMinorUnits: null },
        },
      ]);

      expect((await service.getDashboardSummary(30)).topProducts[0]).toMatchObject({
        refundsMinorUnits: 0,
        netMinorUnits: 1000,
      });
    });

    it('ranks on net, so a heavily-returned product does not top the list', async () => {
      // The one place ignoring returns does active harm rather than merely
      // overstating a total: this list decides what gets restocked.
      prisma.orderItem.findMany.mockResolvedValue([
        {
          quantity: 1,
          unitPriceMinorUnits: 100000,
          productNameSnapshot: 'Mostly returned',
          variant: { productId: 'p-returned' },
          returnRequest: { status: 'REFUNDED', refundAmountMinorUnits: 95000 },
        },
        {
          quantity: 1,
          unitPriceMinorUnits: 50000,
          productNameSnapshot: 'Kept',
          variant: { productId: 'p-kept' },
        },
      ]);

      expect((await service.getDashboardSummary(30)).topProducts[0].productId).toBe('p-kept');
    });

    it('sorts top products by revenue descending', async () => {
      prisma.orderItem.findMany.mockResolvedValue([
        { quantity: 1, unitPriceMinorUnits: 100, productNameSnapshot: 'Cheap', variant: { productId: 'p-low' } },
        { quantity: 1, unitPriceMinorUnits: 100000, productNameSnapshot: 'Expensive', variant: { productId: 'p-high' } },
      ]);
      const result = await service.getDashboardSummary(30);
      expect(result.topProducts[0].productId).toBe('p-high');
    });

    it('caps the result at 5 products even when more exist', async () => {
      const items = Array.from({ length: 8 }, (_, i) => ({
        quantity: 1,
        unitPriceMinorUnits: i + 1,
        productNameSnapshot: `P${i}`,
        variant: { productId: `p${i}` },
      }));
      prisma.orderItem.findMany.mockResolvedValue(items);
      const result = await service.getDashboardSummary(30);
      expect(result.topProducts).toHaveLength(5);
    });
  });
});
