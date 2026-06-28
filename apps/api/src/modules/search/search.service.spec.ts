import { SearchService } from './search.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { Client } from '@elastic/elasticsearch';

type MockPrisma = { product: { findUnique: jest.Mock; findMany: jest.Mock } };
type MockEs = {
  indices: { exists: jest.Mock; create: jest.Mock };
  index: jest.Mock;
  delete: jest.Mock;
  bulk: jest.Mock;
  search: jest.Mock;
};

function fakeIndexableProduct(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'p1',
    slug: 'gold-ring',
    name: 'Gold Ring',
    description: 'd',
    status: 'PUBLISHED',
    deletedAt: null,
    category: { slug: 'rings', name: 'Rings' },
    certificationType: 'BIS_HALLMARK',
    avgRating: 4.2,
    ratingCount: 5,
    createdAt: new Date('2026-01-01'),
    variants: [{ basePriceMinorUnits: 1000, metal: 'GOLD', purity: '18K', inventory: { quantityOnHand: 5, quantityReserved: 2 } }],
    ...overrides,
  };
}

describe('SearchService', () => {
  let prisma: MockPrisma;
  let es: MockEs;
  let eventBus: { on: jest.Mock };
  let service: SearchService;

  beforeEach(() => {
    prisma = { product: { findUnique: jest.fn(), findMany: jest.fn() } };
    es = {
      indices: { exists: jest.fn(), create: jest.fn() },
      index: jest.fn(),
      delete: jest.fn(),
      bulk: jest.fn(),
      search: jest.fn(),
    };
    eventBus = { on: jest.fn() };
    service = new SearchService(es as unknown as Client, prisma as unknown as PrismaService, eventBus as unknown as EventBusService);
  });

  describe('onModuleInit', () => {
    it('does not throw when Elasticsearch is unreachable at boot', async () => {
      es.indices.exists.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(service.onModuleInit()).resolves.toBeUndefined();
    });

    it('creates the index only if it does not already exist', async () => {
      es.indices.exists.mockResolvedValue({ body: false });
      es.indices.create.mockResolvedValue({});
      await service.onModuleInit();
      expect(es.indices.create).toHaveBeenCalled();
    });

    it('does not recreate an index that already exists', async () => {
      es.indices.exists.mockResolvedValue({ body: true });
      await service.onModuleInit();
      expect(es.indices.create).not.toHaveBeenCalled();
    });

    it('subscribes to product.upserted and product.deleted', async () => {
      es.indices.exists.mockResolvedValue({ body: true });
      await service.onModuleInit();
      expect(eventBus.on).toHaveBeenCalledWith('product.upserted', expect.any(Function));
      expect(eventBus.on).toHaveBeenCalledWith('product.deleted', expect.any(Function));
    });
  });

  describe('indexProduct', () => {
    it('indexes a published product with the computed inStock/isBestseller fields', async () => {
      prisma.product.findUnique.mockResolvedValue(fakeIndexableProduct({ ratingCount: 25 }));
      es.index.mockResolvedValue({});

      await service.indexProduct('p1');

      const doc = es.index.mock.calls[0][0].body;
      expect(doc.inStock).toBe(true); // 5 on hand - 2 reserved = 3 available
      expect(doc.isBestseller).toBe(true); // ratingCount 25 >= threshold 20
    });

    it('computes inStock: false when reserved quantity consumes all on-hand stock', async () => {
      prisma.product.findUnique.mockResolvedValue(
        fakeIndexableProduct({ variants: [{ basePriceMinorUnits: 1000, metal: 'GOLD', inventory: { quantityOnHand: 2, quantityReserved: 2 } }] }),
      );
      es.index.mockResolvedValue({});
      await service.indexProduct('p1');
      expect(es.index.mock.calls[0][0].body.inStock).toBe(false);
    });

    it('deletes from the index instead of indexing when the product is not PUBLISHED', async () => {
      prisma.product.findUnique.mockResolvedValue(fakeIndexableProduct({ status: 'DRAFT' }));
      es.delete.mockResolvedValue({});
      await service.indexProduct('p1');
      expect(es.delete).toHaveBeenCalled();
      expect(es.index).not.toHaveBeenCalled();
    });

    it('deletes from the index when the product has been soft-deleted', async () => {
      prisma.product.findUnique.mockResolvedValue(fakeIndexableProduct({ deletedAt: new Date() }));
      es.delete.mockResolvedValue({});
      await service.indexProduct('p1');
      expect(es.delete).toHaveBeenCalled();
    });

    it('deletes from the index when the product no longer exists at all', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      es.delete.mockResolvedValue({});
      await service.indexProduct('gone');
      expect(es.delete).toHaveBeenCalled();
    });
  });

  describe('deleteProduct', () => {
    it('swallows a 404 (already absent from the index)', async () => {
      es.delete.mockRejectedValue({ meta: { statusCode: 404 } });
      await expect(service.deleteProduct('p1')).resolves.toBeUndefined();
    });

    it('rethrows a non-404 error', async () => {
      es.delete.mockRejectedValue({ meta: { statusCode: 500 } });
      await expect(service.deleteProduct('p1')).rejects.toEqual({ meta: { statusCode: 500 } });
    });
  });

  describe('reindexAll', () => {
    it('returns indexed: 0 without calling bulk when there are no published products', async () => {
      es.indices.exists.mockResolvedValue({ body: true });
      prisma.product.findMany.mockResolvedValue([]);
      const result = await service.reindexAll();
      expect(result).toEqual({ indexed: 0 });
      expect(es.bulk).not.toHaveBeenCalled();
    });

    it('bulk-indexes every published product and reports the count', async () => {
      es.indices.exists.mockResolvedValue({ body: true });
      prisma.product.findMany.mockResolvedValue([fakeIndexableProduct(), fakeIndexableProduct({ id: 'p2' })]);
      es.bulk.mockResolvedValue({ body: { errors: false, items: [] } });

      const result = await service.reindexAll();
      expect(result).toEqual({ indexed: 2 });
      expect(es.bulk.mock.calls[0][0].body).toHaveLength(4); // 2 products x (action + doc)
    });

    it('logs but does not throw when the bulk response reports partial failures', async () => {
      es.indices.exists.mockResolvedValue({ body: true });
      prisma.product.findMany.mockResolvedValue([fakeIndexableProduct()]);
      es.bulk.mockResolvedValue({ body: { errors: true, items: [{ index: { error: 'mapper_parsing_exception' } }] } });

      await expect(service.reindexAll()).resolves.toEqual({ indexed: 1 });
    });
  });

  describe('search', () => {
    it('parses a numeric hits.total (older ES response shape)', async () => {
      es.search.mockResolvedValue({
        body: { hits: { total: 42, hits: [] }, aggregations: {} },
      });
      const result = await service.search({ q: 'ring', page: 1, pageSize: 24 } as any);
      expect(result.total).toBe(42);
    });

    it('parses an object hits.total: { value } (newer ES response shape)', async () => {
      es.search.mockResolvedValue({
        body: { hits: { total: { value: 7 }, hits: [] }, aggregations: {} },
      });
      const result = await service.search({ q: 'ring', page: 1, pageSize: 24 } as any);
      expect(result.total).toBe(7);
    });

    it('maps hit._source into result items', async () => {
      es.search.mockResolvedValue({
        body: { hits: { total: 1, hits: [{ _source: { productId: 'p1', name: 'Gold Ring' } }] }, aggregations: {} },
      });
      const result = await service.search({ q: 'ring', page: 1, pageSize: 24 } as any);
      expect(result.items).toEqual([{ productId: 'p1', name: 'Gold Ring' }]);
    });

    it('parses facet aggregation buckets into the expected shape', async () => {
      es.search.mockResolvedValue({
        body: {
          hits: { total: 0, hits: [] },
          aggregations: {
            metals: { buckets: [{ key: 'GOLD', doc_count: 3 }] },
            categories: { buckets: [{ key: 'rings', doc_count: 5 }] },
            certifications: { buckets: [] },
            priceRanges: { buckets: [{ from: 0, to: 1000, doc_count: 2 }] },
          },
        },
      });
      const result = await service.search({ q: 'ring', page: 1, pageSize: 24 } as any);
      expect(result.facets.metals).toEqual([{ value: 'GOLD', count: 3 }]);
      expect(result.facets.categories).toEqual([{ value: 'rings', count: 5 }]);
      expect(result.facets.priceRanges).toEqual([{ from: 0, to: 1000, count: 2 }]);
    });

    it('handles missing aggregations gracefully (all-empty facets, not a crash)', async () => {
      es.search.mockResolvedValue({ body: { hits: { total: 0, hits: [] } } });
      const result = await service.search({ q: 'ring', page: 1, pageSize: 24 } as any);
      expect(result.facets).toEqual({ metals: [], categories: [], certifications: [], priceRanges: [] });
    });

    it('only includes filter clauses for parameters that were actually provided', async () => {
      es.search.mockResolvedValue({ body: { hits: { total: 0, hits: [] }, aggregations: {} } });
      await service.search({ q: 'ring', page: 1, pageSize: 24, metal: 'GOLD' } as any);
      const filters = es.search.mock.calls[0][0].body.query.function_score.query.bool.filter;
      expect(filters).toEqual([{ term: { metal: 'GOLD' } }]);
    });

    it('builds a price range filter with both bounds when both priceMin and priceMax are given', async () => {
      es.search.mockResolvedValue({ body: { hits: { total: 0, hits: [] }, aggregations: {} } });
      await service.search({ q: 'ring', page: 1, pageSize: 24, priceMin: 1000, priceMax: 5000 } as any);
      const filters = es.search.mock.calls[0][0].body.query.function_score.query.bool.filter;
      expect(filters).toEqual([{ range: { priceMinMinorUnits: { gte: 1000, lte: 5000 } } }]);
    });

    it('builds a price range filter with only the lower bound when priceMax is omitted', async () => {
      es.search.mockResolvedValue({ body: { hits: { total: 0, hits: [] }, aggregations: {} } });
      await service.search({ q: 'ring', page: 1, pageSize: 24, priceMin: 1000 } as any);
      const filters = es.search.mock.calls[0][0].body.query.function_score.query.bool.filter;
      expect(filters).toEqual([{ range: { priceMinMinorUnits: { gte: 1000 } } }]);
    });
  });

  describe('autocomplete', () => {
    it('maps hits to suggestion shape', async () => {
      es.search.mockResolvedValue({
        body: { hits: { hits: [{ _source: { productId: 'p1', slug: 'gold-ring', name: 'Gold Ring' } }] } },
      });
      const result = await service.autocomplete('gold', 8);
      expect(result).toEqual([{ productId: 'p1', slug: 'gold-ring', name: 'Gold Ring' }]);
    });

    it('uses a bool_prefix multi_match query', async () => {
      es.search.mockResolvedValue({ body: { hits: { hits: [] } } });
      await service.autocomplete('gold', 8);
      expect(es.search.mock.calls[0][0].body.query.multi_match.type).toBe('bool_prefix');
    });
  });
});
