import { NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { ProductsService } from './products.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { ProductSort } from './dto/query-products.dto';

type MockPrisma = {
  product: { findMany: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; count: jest.Mock };
  $transaction: jest.Mock;
};

function fakeProduct(id: string, basePriceMinorUnits: number, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    name: `Product ${id}`,
    ratingCount: 0,
    createdAt: new Date('2026-01-01'),
    variants: [{ basePriceMinorUnits }],
    ...overrides,
  };
}

describe('ProductsService', () => {
  let prisma: MockPrisma;
  let eventBus: { emit: jest.Mock };
  let service: ProductsService;

  beforeEach(() => {
    prisma = {
      product: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    eventBus = { emit: jest.fn() };
    service = new ProductsService(prisma as unknown as PrismaService, eventBus as unknown as EventBusService);
  });

  describe('findAll', () => {
    it('filters out products below priceMin and above priceMax (computed from min variant price)', async () => {
      prisma.product.findMany.mockResolvedValue([
        fakeProduct('cheap', 500),
        fakeProduct('mid', 5000),
        fakeProduct('expensive', 50000),
      ]);

      const result = await service.findAll({ page: 1, pageSize: 10, priceMin: 1000, priceMax: 10000 } as any);

      expect(result.items.map((p) => p.id)).toEqual(['mid']);
      expect(result.total).toBe(1);
    });

    it('sorts by PRICE_ASC using each product’s minimum variant price', async () => {
      prisma.product.findMany.mockResolvedValue([fakeProduct('b', 3000), fakeProduct('a', 1000)]);
      const result = await service.findAll({ page: 1, pageSize: 10, sort: ProductSort.PRICE_ASC } as any);
      expect(result.items.map((p) => p.id)).toEqual(['a', 'b']);
    });

    it('sorts by PRICE_DESC', async () => {
      prisma.product.findMany.mockResolvedValue([fakeProduct('a', 1000), fakeProduct('b', 3000)]);
      const result = await service.findAll({ page: 1, pageSize: 10, sort: ProductSort.PRICE_DESC } as any);
      expect(result.items.map((p) => p.id)).toEqual(['b', 'a']);
    });

    it('sorts by POPULARITY using ratingCount', async () => {
      prisma.product.findMany.mockResolvedValue([
        fakeProduct('low', 100, { ratingCount: 2 }),
        fakeProduct('high', 100, { ratingCount: 50 }),
      ]);
      const result = await service.findAll({ page: 1, pageSize: 10, sort: ProductSort.POPULARITY } as any);
      expect(result.items.map((p) => p.id)).toEqual(['high', 'low']);
    });

    it('defaults to NEWEST-first when no sort is given', async () => {
      prisma.product.findMany.mockResolvedValue([
        fakeProduct('older', 100, { createdAt: new Date('2026-01-01') }),
        fakeProduct('newer', 100, { createdAt: new Date('2026-06-01') }),
      ]);
      const result = await service.findAll({ page: 1, pageSize: 10 } as any);
      expect(result.items.map((p) => p.id)).toEqual(['newer', 'older']);
    });

    it('treats a product with zero variants as price 0, not a crash', async () => {
      prisma.product.findMany.mockResolvedValue([fakeProduct('novariant', 0, { variants: [] })]);
      const result = await service.findAll({ page: 1, pageSize: 10, priceMax: 0 } as any);
      expect(result.items).toHaveLength(1);
    });

    it('paginates the filtered/sorted result in memory', async () => {
      prisma.product.findMany.mockResolvedValue([
        fakeProduct('a', 100),
        fakeProduct('b', 100),
        fakeProduct('c', 100),
      ]);
      const result = await service.findAll({ page: 2, pageSize: 2 } as any);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(3);
    });

    it('always scopes the query to PUBLISHED, non-deleted products', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      await service.findAll({ page: 1, pageSize: 10 } as any);
      expect(prisma.product.findMany.mock.calls[0][0].where).toMatchObject({
        status: ProductStatus.PUBLISHED,
        deletedAt: null,
      });
    });
  });

  describe('findBySlug', () => {
    it('throws NotFoundException when no published product matches the slug', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      await expect(service.findBySlug('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns the product when found', async () => {
      const product = fakeProduct('p1', 1000);
      prisma.product.findFirst.mockResolvedValue(product);
      expect(await service.findBySlug('p1')).toBe(product);
    });
  });

  describe('adminFindOne', () => {
    it('throws NotFoundException for a nonexistent product id', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.adminFindOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns the product (including drafts) when found', async () => {
      const product = fakeProduct('p1', 1000);
      prisma.product.findUnique.mockResolvedValue(product);
      expect(await service.adminFindOne('p1')).toBe(product);
    });
  });

  describe('adminCreate / adminUpdate / adminDelete', () => {
    it('adminCreate always sets status DRAFT, even though the caller cannot specify a status', async () => {
      prisma.product.create.mockResolvedValue({ id: 'p1' });
      await service.adminCreate({ name: 'x', slug: 'x', categoryId: 'c1', description: 'd', variants: [] } as any);
      expect(prisma.product.create.mock.calls[0][0].data.status).toBe(ProductStatus.DRAFT);
    });

    it('adminCreate emits product.upserted', async () => {
      prisma.product.create.mockResolvedValue({ id: 'p1' });
      await service.adminCreate({ name: 'x', slug: 'x', categoryId: 'c1', description: 'd', variants: [] } as any);
      expect(eventBus.emit).toHaveBeenCalledWith('product.upserted', { productId: 'p1' });
    });

    it('adminUpdate throws NotFoundException for a nonexistent product before attempting the update', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.adminUpdate('missing', { status: 'PUBLISHED' } as any)).rejects.toThrow(NotFoundException);
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('adminUpdate emits product.upserted on success', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.product.update.mockResolvedValue({ id: 'p1' });
      await service.adminUpdate('p1', { status: 'PUBLISHED' } as any);
      expect(eventBus.emit).toHaveBeenCalledWith('product.upserted', { productId: 'p1' });
    });

    it('adminDelete soft-deletes (sets deletedAt + ARCHIVED) and emits product.deleted', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.product.update.mockResolvedValue({});
      await service.adminDelete('p1');

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { deletedAt: expect.any(Date), status: ProductStatus.ARCHIVED },
      });
      expect(eventBus.emit).toHaveBeenCalledWith('product.deleted', { productId: 'p1' });
    });
  });

  describe('adminFindAll', () => {
    it('excludes soft-deleted products and returns a paginated envelope', async () => {
      prisma.product.findMany.mockResolvedValue([fakeProduct('p1', 100)]);
      prisma.product.count.mockResolvedValue(1);
      const result = await service.adminFindAll({ page: 1, pageSize: 10 });
      expect(prisma.product.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null });
      expect(result).toEqual({ items: [fakeProduct('p1', 100)], page: 1, pageSize: 10, total: 1 });
    });
  });
});
