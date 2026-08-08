import { ModerationStatus } from '@prisma/client';
import {
  NO_RATING,
  deriveRating,
  deriveRatings,
  ratingsDiffer,
  roundRating,
  writeRating,
} from './rating-aggregate';

/**
 * FEAT-RATING-OWNERSHIP §7 — the derivation that ADR-0008 makes the single
 * source of the rating aggregate.
 */
describe('rating-aggregate', () => {
  const client = (rows: any[] = []) =>
    ({
      review: { groupBy: jest.fn().mockResolvedValue(rows) },
      product: { update: jest.fn().mockResolvedValue(undefined) },
    }) as any;

  describe('roundRating', () => {
    it('rounds to the column precision, Decimal(3,2)', () => {
      // Without this, a stored 4.33 and a derived 4.3333… disagree forever and
      // reconciliation never converges (§7.5).
      expect(roundRating(13 / 3)).toBe(4.33);
      expect(roundRating(4.005)).toBe(4.01);
      expect(roundRating(5)).toBe(5);
    });
  });

  describe('deriveRatings', () => {
    it('counts only APPROVED reviews', async () => {
      const c = client();
      await deriveRatings(c);
      expect(c.review.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ moderationStatus: ModerationStatus.APPROVED }),
        }),
      );
    });

    it('scopes to the given products when asked', async () => {
      const c = client();
      await deriveRatings(c, ['p1', 'p2']);
      expect(c.review.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ productId: { in: ['p1', 'p2'] } }),
        }),
      );
    });

    it('rounds the derived average', async () => {
      const c = client([{ productId: 'p1', _avg: { rating: 13 / 3 }, _count: { rating: 3 } }]);
      expect((await deriveRatings(c)).get('p1')).toEqual({ avgRating: 4.33, ratingCount: 3 });
    });

    it('omits products with no approved reviews rather than inventing a row', async () => {
      expect((await deriveRatings(client())).has('p1')).toBe(false);
    });
  });

  describe('deriveRating', () => {
    it('returns the zero state for a product with no approved reviews (§7.1)', async () => {
      // Not null, and not "leave the previous value alone" — this is the case
      // that makes rejecting the last approved review work (§7.2).
      expect(await deriveRating(client(), 'p1')).toEqual({ avgRating: 0, ratingCount: 0 });
      expect(NO_RATING).toEqual({ avgRating: 0, ratingCount: 0 });
    });

    it('returns the derived aggregate when reviews exist', async () => {
      const c = client([{ productId: 'p1', _avg: { rating: 4.5 }, _count: { rating: 2 } }]);
      expect(await deriveRating(c, 'p1')).toEqual({ avgRating: 4.5, ratingCount: 2 });
    });

    it('derives rather than increments, so it is idempotent (§7.6)', async () => {
      const c = client([{ productId: 'p1', _avg: { rating: 4 }, _count: { rating: 5 } }]);
      const first = await deriveRating(c, 'p1');
      const second = await deriveRating(c, 'p1');
      expect(second).toEqual(first);
    });
  });

  describe('ratingsDiffer', () => {
    it('is false for equal aggregates', () => {
      expect(ratingsDiffer({ avgRating: 4.5, ratingCount: 2 }, { avgRating: 4.5, ratingCount: 2 })).toBe(
        false,
      );
    });

    it('does not report drift for a difference below column precision', () => {
      // 4.33 stored vs 4.3333… derived is the same value as far as the column
      // is concerned; reporting it would make every run report every product.
      expect(ratingsDiffer({ avgRating: 4.33, ratingCount: 3 }, { avgRating: 13 / 3, ratingCount: 3 })).toBe(
        false,
      );
    });

    it('reports a changed average', () => {
      expect(ratingsDiffer({ avgRating: 4.5, ratingCount: 2 }, { avgRating: 4.0, ratingCount: 2 })).toBe(true);
    });

    it('reports a changed count even when the average matches', () => {
      // The count is its own signal — it drives search ranking's popularity
      // factor independently of the average.
      expect(ratingsDiffer({ avgRating: 4.5, ratingCount: 2 }, { avgRating: 4.5, ratingCount: 3 })).toBe(true);
    });

    it('reports a rating that should have fallen to zero (§7.2)', () => {
      expect(ratingsDiffer({ avgRating: 4.5, ratingCount: 1 }, NO_RATING)).toBe(true);
    });
  });

  describe('writeRating', () => {
    it('writes both fields together', async () => {
      const c = client();
      await writeRating(c, 'p1', { avgRating: 4.5, ratingCount: 2 });
      expect(c.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { avgRating: 4.5, ratingCount: 2 },
      });
    });
  });
});
