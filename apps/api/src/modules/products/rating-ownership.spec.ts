import { Prisma } from '@prisma/client';
import { ProductsService } from './products.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { SizesService } from '../sizes/sizes.service';
import { StorageProviderPort } from '../storage/ports/storage-provider.port';

/**
 * FEAT-RATING-OWNERSHIP — Catalog owning the rating aggregate (ADR-0008).
 *
 * These are the tests that would have caught KC-142: the aggregate having no
 * single owner, so nothing could guarantee it was right.
 */
describe('ProductsService — rating aggregates', () => {
  let prisma: any;
  let eventBus: { emit: jest.Mock };
  let service: ProductsService;

  /** Approved-review rows as `groupBy` would return them. */
  const approved = (rows: Array<{ productId: string; avg: number; count: number }>) =>
    rows.map((r) => ({ productId: r.productId, _avg: { rating: r.avg }, _count: { rating: r.count } }));

  const dec = (n: number) => new Prisma.Decimal(n);

  beforeEach(() => {
    prisma = {
      product: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
      review: { groupBy: jest.fn().mockResolvedValue([]) },
      // Runs the callback against the same mock, as a real interactive
      // transaction runs it against a transaction client.
      $transaction: jest.fn((work: any) => (typeof work === 'function' ? work(prisma) : Promise.all(work))),
    };
    eventBus = { emit: jest.fn() };
    service = new ProductsService(
      prisma as unknown as PrismaService,
      eventBus as unknown as EventBusService,
      {} as unknown as StorageProviderPort,
      {} as unknown as SizesService,
    );
  });

  describe('withRatingRecompute', () => {
    it('runs the caller’s work and the recompute in one transaction', async () => {
      prisma.review.groupBy.mockResolvedValue(approved([{ productId: 'p1', avg: 4.5, count: 2 }]));
      const work = jest.fn().mockResolvedValue('done');

      await service.withRatingRecompute('p1', work);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(work).toHaveBeenCalled();
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { avgRating: 4.5, ratingCount: 2 },
      });
    });

    it('returns the caller’s result, not the aggregate', async () => {
      await expect(service.withRatingRecompute('p1', async () => ({ id: 'r1' }))).resolves.toEqual({
        id: 'r1',
      });
    });

    it('emits product.upserted — Catalog owns the emission (§3.2)', async () => {
      await service.withRatingRecompute('p1', async () => undefined);
      expect(eventBus.emit).toHaveBeenCalledWith('product.upserted', { productId: 'p1' });
    });

    it('emits AFTER the transaction commits, never inside it (§5)', async () => {
      // Search re-reads the product when it handles the event. Emitted inside
      // the transaction it would index the pre-commit value.
      let emittedDuringTransaction = false;
      prisma.$transaction.mockImplementation(async (work: any) => {
        const result = await work(prisma);
        emittedDuringTransaction = eventBus.emit.mock.calls.length > 0;
        return result;
      });

      await service.withRatingRecompute('p1', async () => undefined);

      expect(emittedDuringTransaction).toBe(false);
      expect(eventBus.emit).toHaveBeenCalledTimes(1);
    });

    it('does not emit when the transaction fails (§7.7)', async () => {
      prisma.$transaction.mockRejectedValue(new Error('rollback'));

      await expect(service.withRatingRecompute('p1', async () => undefined)).rejects.toThrow('rollback');
      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    it('writes zero when the last approved review is gone (§7.2)', async () => {
      // groupBy returns no row for a product with no approved reviews. Reading
      // that absence as "leave it alone" would strand the old rating forever.
      prisma.review.groupBy.mockResolvedValue([]);

      await service.withRatingRecompute('p1', async () => undefined);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { avgRating: 0, ratingCount: 0 },
      });
    });
  });

  describe('recomputeRating', () => {
    it('returns the derived aggregate', async () => {
      prisma.review.groupBy.mockResolvedValue(approved([{ productId: 'p1', avg: 4, count: 7 }]));
      await expect(service.recomputeRating('p1')).resolves.toEqual({ avgRating: 4, ratingCount: 7 });
    });
  });

  describe('reconcileRatings', () => {
    it('reports and corrects a drifted product', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'Drifted Ring', avgRating: dec(2.0), ratingCount: 1 },
      ]);
      prisma.review.groupBy.mockResolvedValue(approved([{ productId: 'p1', avg: 4.5, count: 2 }]));

      const result = await service.reconcileRatings();

      expect(result).toMatchObject({ scanned: 1, drifted: 1, corrected: 1, dryRun: false });
      expect(result.products[0]).toEqual({
        productId: 'p1',
        name: 'Drifted Ring',
        stored: { avgRating: 2, ratingCount: 1 },
        correct: { avgRating: 4.5, ratingCount: 2 },
      });
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { avgRating: 4.5, ratingCount: 2 },
      });
    });

    it('leaves a correct product alone and emits nothing (§3.8)', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'Fine', avgRating: dec(4.5), ratingCount: 2 },
      ]);
      prisma.review.groupBy.mockResolvedValue(approved([{ productId: 'p1', avg: 4.5, count: 2 }]));

      const result = await service.reconcileRatings();

      expect(result).toMatchObject({ scanned: 1, drifted: 0, corrected: 0 });
      expect(prisma.product.update).not.toHaveBeenCalled();
      // Reindexing the whole catalogue to fix nothing is the failure mode here.
      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    it('emits only for the products it corrected', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'Fine', avgRating: dec(4.5), ratingCount: 2 },
        { id: 'p2', name: 'Drifted', avgRating: dec(1), ratingCount: 9 },
      ]);
      prisma.review.groupBy.mockResolvedValue(
        approved([
          { productId: 'p1', avg: 4.5, count: 2 },
          { productId: 'p2', avg: 3, count: 1 },
        ]),
      );

      await service.reconcileRatings();

      expect(eventBus.emit).toHaveBeenCalledTimes(1);
      expect(eventBus.emit).toHaveBeenCalledWith('product.upserted', { productId: 'p2' });
    });

    it('resets a product whose approved reviews are all gone (§7.2)', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'Stale', avgRating: dec(5), ratingCount: 3 },
      ]);
      prisma.review.groupBy.mockResolvedValue([]);

      const result = await service.reconcileRatings();

      expect(result.products[0].correct).toEqual({ avgRating: 0, ratingCount: 0 });
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { avgRating: 0, ratingCount: 0 },
      });
    });

    it('does not report drift from rounding alone (§7.5)', async () => {
      // Stored 4.33 against a derived 13/3. Reporting this would make every
      // run report every product, forever.
      prisma.product.findMany.mockResolvedValue([
        { id: 'p1', name: 'Rounded', avgRating: dec(4.33), ratingCount: 3 },
      ]);
      prisma.review.groupBy.mockResolvedValue(approved([{ productId: 'p1', avg: 13 / 3, count: 3 }]));

      expect(await service.reconcileRatings()).toMatchObject({ drifted: 0 });
    });

    it('includes soft-deleted products (§7.4)', async () => {
      // A product can be restored; restoring one with a stale rating would
      // reintroduce the drift this removes.
      await service.reconcileRatings();
      const where = prisma.product.findMany.mock.calls[0][0]?.where;
      expect(where?.deletedAt).toBeUndefined();
    });

    describe('dryRun', () => {
      beforeEach(() => {
        prisma.product.findMany.mockResolvedValue([
          { id: 'p1', name: 'Drifted', avgRating: dec(2), ratingCount: 1 },
        ]);
        prisma.review.groupBy.mockResolvedValue(approved([{ productId: 'p1', avg: 4.5, count: 2 }]));
      });

      it('reports the drift', async () => {
        const result = await service.reconcileRatings({ dryRun: true });
        expect(result).toMatchObject({ scanned: 1, drifted: 1, corrected: 0, dryRun: true });
        expect(result.products).toHaveLength(1);
      });

      it('writes nothing and emits nothing', async () => {
        await service.reconcileRatings({ dryRun: true });
        expect(prisma.product.update).not.toHaveBeenCalled();
        expect(eventBus.emit).not.toHaveBeenCalled();
      });
    });

    it('is idempotent — a second run reports zero drift (§7.6)', async () => {
      // The criterion that proves the derivation is honest. The stored value
      // follows what the first run wrote.
      const stored = { id: 'p1', name: 'Ring', avgRating: dec(2), ratingCount: 1 };
      prisma.product.findMany.mockImplementation(async () => [stored]);
      prisma.review.groupBy.mockResolvedValue(approved([{ productId: 'p1', avg: 4.5, count: 2 }]));
      prisma.product.update.mockImplementation(async ({ data }: any) => {
        stored.avgRating = dec(data.avgRating);
        stored.ratingCount = data.ratingCount;
        return stored;
      });

      expect(await service.reconcileRatings()).toMatchObject({ drifted: 1, corrected: 1 });
      expect(await service.reconcileRatings()).toMatchObject({ drifted: 0, corrected: 0 });
    });
  });
});
