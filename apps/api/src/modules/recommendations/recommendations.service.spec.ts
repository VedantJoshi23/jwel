import { RecommendationsService } from './recommendations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';

type MockPrisma = {
  productView: { create: jest.Mock; findMany: jest.Mock };
  productCoOccurrence: { deleteMany: jest.Mock; findMany: jest.Mock; upsert: jest.Mock };
  orderItem: { findMany: jest.Mock; groupBy: jest.Mock };
  order: { findMany: jest.Mock };
  product: { findUnique: jest.Mock; findMany: jest.Mock };
  productVariant: { findMany: jest.Mock };
};

function fakeProduct(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    slug: `slug-${id}`,
    name: `Product ${id}`,
    category: { slug: 'rings' },
    variants: [{ basePriceMinorUnits: 1000 }],
    avgRating: 4.5,
    ratingCount: 10,
    media: [],
    ...overrides,
  };
}

describe('RecommendationsService', () => {
  let prisma: MockPrisma;
  let eventBus: { on: jest.Mock; emit: jest.Mock };
  let service: RecommendationsService;

  beforeEach(() => {
    prisma = {
      productView: { create: jest.fn(), findMany: jest.fn() },
      productCoOccurrence: { deleteMany: jest.fn(), findMany: jest.fn(), upsert: jest.fn() },
      orderItem: { findMany: jest.fn(), groupBy: jest.fn() },
      order: { findMany: jest.fn() },
      product: { findUnique: jest.fn(), findMany: jest.fn() },
      productVariant: { findMany: jest.fn() },
    };
    eventBus = { on: jest.fn(), emit: jest.fn() };
    service = new RecommendationsService(prisma as unknown as PrismaService, eventBus as unknown as EventBusService);
  });

  describe('onModuleInit', () => {
    it('subscribes to the order.confirmed event', () => {
      service.onModuleInit();
      expect(eventBus.on).toHaveBeenCalledWith('order.confirmed', expect.any(Function));
    });
  });

  describe('recordView', () => {
    it('is a silent no-op when there is no userId and no anonymousId', async () => {
      await service.recordView('p1', {});
      expect(prisma.productView.create).not.toHaveBeenCalled();
    });

    it('records under userId and ignores any anonymousId when both are present', async () => {
      await service.recordView('p1', { userId: 'u1', anonymousId: 'anon-1' });
      expect(prisma.productView.create).toHaveBeenCalledWith({
        data: { productId: 'p1', userId: 'u1', anonymousId: null },
      });
    });

    it('records under anonymousId for a guest', async () => {
      await service.recordView('p1', { anonymousId: 'anon-1' });
      expect(prisma.productView.create).toHaveBeenCalledWith({
        data: { productId: 'p1', userId: undefined, anonymousId: 'anon-1' },
      });
    });
  });

  describe('getRecentlyViewed', () => {
    it('returns [] when there is no identity at all', async () => {
      expect(await service.getRecentlyViewed({}, 10)).toEqual([]);
      expect(prisma.productView.findMany).not.toHaveBeenCalled();
    });

    it('de-duplicates repeat views of the same product, preserving most-recent-first order', async () => {
      prisma.productView.findMany.mockResolvedValue([
        { productId: 'p2' },
        { productId: 'p1' },
        { productId: 'p2' },
        { productId: 'p3' },
      ]);
      prisma.product.findMany.mockResolvedValue([fakeProduct('p2'), fakeProduct('p1'), fakeProduct('p3')]);

      const result = await service.getRecentlyViewed({ userId: 'u1' }, 10);
      expect(result.map((i) => i.productId)).toEqual(['p2', 'p1', 'p3']);
    });

    it('stops collecting distinct ids once the limit is reached', async () => {
      prisma.productView.findMany.mockResolvedValue([{ productId: 'p1' }, { productId: 'p2' }, { productId: 'p3' }]);
      prisma.product.findMany.mockResolvedValue([fakeProduct('p1')]);

      await service.getRecentlyViewed({ userId: 'u1' }, 1);
      expect(prisma.product.findMany.mock.calls[0][0].where.id.in).toEqual(['p1']);
    });
  });

  describe('getFrequentlyBoughtTogether', () => {
    it('resolves the "other" product id from either side of the pair', async () => {
      prisma.productCoOccurrence.findMany.mockResolvedValue([
        { productAId: 'self', productBId: 'other-1', coOccurrenceCount: 5 },
        { productAId: 'other-2', productBId: 'self', coOccurrenceCount: 3 },
      ]);
      prisma.product.findMany.mockResolvedValue([fakeProduct('other-1'), fakeProduct('other-2')]);

      const result = await service.getFrequentlyBoughtTogether('self', 2);
      expect(result.map((i) => i.productId)).toEqual(['other-1', 'other-2']);
    });

    it('falls back to same-category bestsellers when there are fewer co-occurrence results than the limit', async () => {
      prisma.productCoOccurrence.findMany.mockResolvedValue([
        { productAId: 'self', productBId: 'other-1', coOccurrenceCount: 5 },
      ]);
      prisma.product.findMany
        .mockResolvedValueOnce([fakeProduct('other-1')]) // fetchPublishedInOrder
        .mockResolvedValueOnce([fakeProduct('fallback-1')]); // category fallback
      prisma.product.findUnique.mockResolvedValue({ categoryId: 'cat-1' });

      const result = await service.getFrequentlyBoughtTogether('self', 3);
      expect(result.map((i) => i.productId)).toEqual(['other-1', 'fallback-1']);
    });

    it('returns just the co-occurrence results (no fallback lookup) when self product cannot be found', async () => {
      prisma.productCoOccurrence.findMany.mockResolvedValue([]);
      prisma.product.findMany.mockResolvedValueOnce([]);
      prisma.product.findUnique.mockResolvedValue(null);

      const result = await service.getFrequentlyBoughtTogether('ghost', 3);
      expect(result).toEqual([]);
    });
  });

  describe('getTrending', () => {
    it('falls back to bestsellers when there is no recent order activity', async () => {
      prisma.orderItem.groupBy.mockResolvedValue([]);
      prisma.product.findMany.mockResolvedValue([fakeProduct('best-1')]);

      const result = await service.getTrending(5);
      expect(result.map((i) => i.productId)).toEqual(['best-1']);
    });

    it('ranks products by summed quantity across their variants', async () => {
      prisma.orderItem.groupBy.mockResolvedValue([
        { variantId: 'v1', _sum: { quantity: 10 } },
        { variantId: 'v2', _sum: { quantity: 3 } },
      ]);
      prisma.productVariant.findMany.mockResolvedValue([
        { id: 'v1', productId: 'p-popular' },
        { id: 'v2', productId: 'p-less-popular' },
      ]);
      prisma.product.findMany.mockResolvedValue([fakeProduct('p-popular'), fakeProduct('p-less-popular')]);

      const result = await service.getTrending(5);
      expect(result[0].productId).toBe('p-popular');
    });

    it('caches results across calls within the TTL — a second call does not re-query', async () => {
      prisma.orderItem.groupBy.mockResolvedValue([]);
      prisma.product.findMany.mockResolvedValue([fakeProduct('best-1')]);

      await service.getTrending(5);
      await service.getTrending(5);

      expect(prisma.orderItem.groupBy).toHaveBeenCalledTimes(1);
    });

    it('tops up with bestsellers when recent sales exist but yield fewer published items than the limit', async () => {
      prisma.orderItem.groupBy.mockResolvedValue([{ variantId: 'v1', _sum: { quantity: 5 } }]);
      prisma.productVariant.findMany.mockResolvedValue([{ id: 'v1', productId: 'sold-but-unpublished' }]);
      prisma.product.findMany
        .mockResolvedValueOnce([]) // fetchPublishedInOrder finds nothing (it was unpublished since)
        .mockResolvedValueOnce([fakeProduct('bestseller-1')]); // getBestsellers top-up

      const result = await service.getTrending(3);
      expect(result.map((i) => i.productId)).toEqual(['bestseller-1']);
    });
  });

  describe('getPersonalized', () => {
    it('cold-starts to Trending (reason: trending) when the user has no purchase history', async () => {
      prisma.orderItem.findMany.mockResolvedValue([]);
      prisma.orderItem.groupBy.mockResolvedValue([]);
      prisma.product.findMany.mockResolvedValue([fakeProduct('best-1')]);

      const result = await service.getPersonalized('new-user', 5);
      expect(result).toEqual([expect.objectContaining({ productId: 'best-1', reason: 'trending' })]);
    });

    it('excludes already-purchased products from co-occurrence candidates', async () => {
      prisma.orderItem.findMany.mockResolvedValue([
        {
          variant: { productId: 'already-owned-a', product: { categoryId: 'cat-1' } },
        },
        {
          variant: { productId: 'already-owned-b', product: { categoryId: 'cat-1' } },
        },
      ]);
      // Both ends of the only co-occurrence pair are things the user already owns.
      prisma.productCoOccurrence.findMany.mockResolvedValue([
        { productAId: 'already-owned-a', productBId: 'already-owned-b', coOccurrenceCount: 9 },
      ]);
      prisma.product.findMany
        .mockResolvedValueOnce([]) // category fallback finds nothing either
        .mockResolvedValueOnce([fakeProduct('best-1')]); // trending top-up fallback
      prisma.orderItem.groupBy.mockResolvedValue([]);

      const result = await service.getPersonalized('u1', 5);
      // Nothing came from co-occurrence (both ends excluded); falls through to trending top-up.
      expect(result.every((item) => item.reason === 'trending')).toBe(true);
    });

    it('scores a genuine co-occurrence candidate higher than this milestone’s scope expects category matches to', async () => {
      prisma.orderItem.findMany.mockResolvedValue([
        { variant: { productId: 'owned-1', product: { categoryId: 'cat-1' } } },
      ]);
      prisma.productCoOccurrence.findMany.mockResolvedValue([
        { productAId: 'owned-1', productBId: 'co-bought', coOccurrenceCount: 9 },
      ]);
      prisma.product.findMany
        .mockResolvedValueOnce([]) // category fallback (size already >= limit path may skip; harmless if called)
        .mockResolvedValueOnce([fakeProduct('co-bought'), fakeProduct('category-match')]) // fetchPublishedInOrder
        .mockResolvedValue([]); // trending top-up fallback, if it runs
      prisma.orderItem.groupBy.mockResolvedValue([]);

      const result = await service.getPersonalized('u1', 5);
      expect(result[0].productId).toBe('co-bought');
      expect(result[0].reason).toBe('co_purchased');
    });

    it('does not let a category match overwrite an existing co-occurrence score for the same product', async () => {
      prisma.orderItem.findMany.mockResolvedValue([
        { variant: { productId: 'owned-1', product: { categoryId: 'cat-1' } } },
      ]);
      // co-occurrence already scores 'shared-id'; category fallback also matches it.
      prisma.productCoOccurrence.findMany.mockResolvedValue([
        { productAId: 'owned-1', productBId: 'shared-id', coOccurrenceCount: 9 },
      ]);
      prisma.product.findMany
        .mockResolvedValueOnce([{ id: 'shared-id', ratingCount: 1 }]) // category fallback candidates
        .mockResolvedValueOnce([fakeProduct('shared-id')]) // fetchPublishedInOrder
        .mockResolvedValue([]); // trending top-up fallback, if it runs (only 1 candidate < limit 5)
      prisma.orderItem.groupBy.mockResolvedValue([]);

      const result = await service.getPersonalized('u1', 5);
      expect(result[0].reason).toBe('co_purchased'); // not overwritten to category_affinity
    });

    it('skips the trending top-up when there are already enough scored candidates', async () => {
      prisma.orderItem.findMany.mockResolvedValue([
        { variant: { productId: 'owned-1', product: { categoryId: 'cat-1' } } },
      ]);
      prisma.productCoOccurrence.findMany.mockResolvedValue([
        { productAId: 'owned-1', productBId: 'co-1', coOccurrenceCount: 9 },
      ]);
      prisma.product.findMany.mockResolvedValueOnce([fakeProduct('co-1')]); // limit=1, satisfied by co-occurrence alone

      const result = await service.getPersonalized('u1', 1);
      expect(result).toHaveLength(1);
      expect(prisma.orderItem.groupBy).not.toHaveBeenCalled(); // getTrending (top-up) never invoked
    });
  });

  describe('backfillCoOccurrence', () => {
    it('wipes the co-occurrence table before rebuilding it', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      await service.backfillCoOccurrence();
      expect(prisma.productCoOccurrence.deleteMany).toHaveBeenCalledWith({});
    });

    it('processes every non-cancelled order and reports the count', async () => {
      prisma.order.findMany.mockResolvedValue([{ id: 'o1' }, { id: 'o2' }]);
      prisma.orderItem.findMany.mockResolvedValue([]); // each order has < 2 distinct products -> no-op pairing
      const result = await service.backfillCoOccurrence();
      expect(result).toEqual({ ordersProcessed: 2 });
    });

    it('excludes CANCELLED orders from the backfill query', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      await service.backfillCoOccurrence();
      expect(prisma.order.findMany.mock.calls[0][0].where.status.not).toBe('CANCELLED');
    });

    it('upserts exactly one co-occurrence row for a 2-distinct-product order, with the lexicographically smaller id first', async () => {
      prisma.order.findMany.mockResolvedValue([{ id: 'o1' }]);
      prisma.orderItem.findMany.mockResolvedValue([
        { variant: { productId: 'zzz' } },
        { variant: { productId: 'aaa' } },
      ]);

      await service.backfillCoOccurrence();

      expect(prisma.productCoOccurrence.upsert).toHaveBeenCalledTimes(1);
      const call = prisma.productCoOccurrence.upsert.mock.calls[0][0];
      expect(call.create).toEqual({ productAId: 'aaa', productBId: 'zzz', coOccurrenceCount: 1 });
    });

    it('does not create any co-occurrence row for a single-item order', async () => {
      prisma.order.findMany.mockResolvedValue([{ id: 'o1' }]);
      prisma.orderItem.findMany.mockResolvedValue([{ variant: { productId: 'only-one' } }]);

      await service.backfillCoOccurrence();

      expect(prisma.productCoOccurrence.upsert).not.toHaveBeenCalled();
    });
  });
});
