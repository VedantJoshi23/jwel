import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';

type MockPrisma = {
  order: { findMany: jest.Mock; groupBy: jest.Mock };
  orderItem: { findMany: jest.Mock };
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
      review: { count: jest.fn().mockResolvedValue(0) },
      user: { count: jest.fn().mockResolvedValue(0) },
    };
    inventory = { listLowStock: jest.fn().mockResolvedValue([]) };
    service = new AnalyticsService(prisma as unknown as PrismaService, inventory as unknown as InventoryService);
  });

  it('computes revenue as the sum of order totals in the window', async () => {
    prisma.order.findMany.mockResolvedValue([{ totalMinorUnits: 10000 }, { totalMinorUnits: 25000 }]);
    const result = await service.getDashboardSummary(30);
    expect(result.revenueMinorUnits).toBe(35000);
    expect(result.orderCount).toBe(2);
  });

  it('computes average order value as revenue / orderCount, rounded', async () => {
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
      expect(ring).toEqual({ productId: 'p1', name: 'Ring', unitsSold: 3, revenueMinorUnits: 3000 });
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
