import { RecommendationsService } from './recommendations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageProviderPort } from '../storage/ports/storage-provider.port';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { SettingsService } from '../settings/settings.service';

/**
 * `DOM-RECOMMENDATION` Invariant 8 — a pair is only recommendable at a
 * co-occurrence count at or above the threshold.
 *
 * This was an owner decision on 2026-08-07 and was enforced **nowhere**: the
 * query ordered by count and took the top N, so a pair seen once was surfaced
 * under a heading that says "frequently". Two people who happened to buy the
 * same two things is not a pattern.
 */
describe('RecommendationsService — the co-occurrence threshold', () => {
  let prisma: any;
  let settings: { get: jest.Mock };
  let service: RecommendationsService;

  beforeEach(() => {
    prisma = {
      productCoOccurrence: { findMany: jest.fn().mockResolvedValue([]) },
      product: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      // The personalised path falls through to category matches and then
      // trending when nothing scores; these keep that tail from throwing so
      // the assertion above it is the thing under test.
      orderItem: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
      productVariant: { findMany: jest.fn().mockResolvedValue([]) },
    };
    settings = { get: jest.fn().mockResolvedValue(5) };
    const storage = { resolveUrl: (ref: string) => `https://cdn.test/${ref}` };
    service = new RecommendationsService(
      prisma as unknown as PrismaService,
      { on: jest.fn(), emit: jest.fn() } as unknown as EventBusService,
      settings as unknown as SettingsService,
      storage as unknown as StorageProviderPort,
    );
  });

  describe('frequently bought together', () => {
    it('asks the setting rather than hardcoding the threshold', async () => {
      await service.getFrequentlyBoughtTogether('p1', 4);
      expect(settings.get).toHaveBeenCalledWith('recommendations.min_co_occurrence');
    });

    it('filters pairs below the threshold in the query, not after', async () => {
      // In the query, so a product with fifty noisy pairs and three real ones
      // does not have the real ones pushed out of `take`.
      await service.getFrequentlyBoughtTogether('p1', 4);

      expect(prisma.productCoOccurrence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ coOccurrenceCount: { gte: 5 } }),
        }),
      );
    });

    it('uses a tuned threshold when an admin has changed it', async () => {
      // The invariant calls 5 "a starting heuristic to be tuned against real
      // data", which is a setting, not a constant.
      settings.get.mockResolvedValue(12);
      await service.getFrequentlyBoughtTogether('p1', 4);

      expect(prisma.productCoOccurrence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ coOccurrenceCount: { gte: 12 } }),
        }),
      );
    });
  });

  describe('personalised recommendations', () => {
    it('applies the same threshold — the invariant is about the pair, not the rail', async () => {
      prisma.orderItem.findMany.mockResolvedValue([
        { variant: { productId: 'bought-1', product: { categoryId: 'c1' } } },
      ]);

      await service.getPersonalized('u1', 4);

      expect(prisma.productCoOccurrence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ coOccurrenceCount: { gte: 5 } }),
        }),
      );
    });
  });
});
