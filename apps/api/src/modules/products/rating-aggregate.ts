import { ModerationStatus, Prisma } from '@prisma/client';

/**
 * FEAT-RATING-OWNERSHIP — the one derivation of a product's rating aggregate.
 *
 * `Product.avgRating` and `ratingCount` are a **deliberate stored derivation**
 * — the documented exception to `STD-DATABASE` r9 — kept so a PLP or PDP read
 * does not run `AVG`/`COUNT` over reviews. Reconciliation is the price of that
 * exception, and this module is where it is paid.
 *
 * Everything derives from the approved review set rather than incrementing.
 * That is what makes the recompute **idempotent and bulk-runnable** (KC-159):
 * the same arithmetic reconciles one product or the whole catalogue, and
 * rejecting the last approved review correctly returns the aggregate to zero,
 * which an incrementing implementation gets wrong.
 *
 * The client is typed structurally rather than as `PrismaService` so the
 * service, a transaction client and `seed-demo.ts`'s plain `PrismaClient` can
 * all share it. `STD-CODE`: one derivation, not three copies that drift.
 */

/** `avg_rating` is `Decimal(3,2)`. Anything finer cannot survive a round trip. */
export const RATING_DECIMAL_PLACES = 2;

export interface RatingAggregate {
  avgRating: number;
  ratingCount: number;
}

/** The zero state: a product with no approved reviews. Never null (§7.1). */
export const NO_RATING: RatingAggregate = { avgRating: 0, ratingCount: 0 };

/**
 * `Prisma.TransactionClient` rather than `PrismaService`, so the service, a
 * transaction client and a seed script's plain `PrismaClient` all satisfy it —
 * a full client has strictly more members than this and is assignable.
 */
export type RatingClient = Prisma.TransactionClient;

/**
 * Rounds to the column's precision.
 *
 * Without this, a stored `4.33` compared against a derived `4.333…` reports
 * drift on every run, forever — reconciliation would never converge and its
 * report would be worthless (§7.5).
 */
export function roundRating(value: number): number {
  const factor = 10 ** RATING_DECIMAL_PLACES;
  return Math.round(value * factor) / factor;
}

/**
 * Derives aggregates for the given products, or for every product with at
 * least one approved review when `productIds` is omitted.
 *
 * Products absent from the returned map have **no approved reviews** and must
 * be treated as {@link NO_RATING} — `groupBy` cannot return a row for a
 * product that has none, and reading that absence as "leave it alone" is
 * exactly the bug in §7.2.
 */
export async function deriveRatings(
  client: RatingClient,
  productIds?: string[],
): Promise<Map<string, RatingAggregate>> {
  const rows = await client.review.groupBy({
    by: ['productId'],
    where: {
      moderationStatus: ModerationStatus.APPROVED,
      ...(productIds ? { productId: { in: productIds } } : {}),
    },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return new Map(
    rows.map((row) => [
      row.productId,
      { avgRating: roundRating(row._avg.rating ?? 0), ratingCount: row._count.rating },
    ]),
  );
}

/** The aggregate for one product, defaulting to the zero state. */
export async function deriveRating(
  client: RatingClient,
  productId: string,
): Promise<RatingAggregate> {
  const derived = await deriveRatings(client, [productId]);
  return derived.get(productId) ?? NO_RATING;
}

/** Whether a stored aggregate differs from the derived one, at column precision. */
export function ratingsDiffer(stored: RatingAggregate, derived: RatingAggregate): boolean {
  return (
    roundRating(stored.avgRating) !== roundRating(derived.avgRating) ||
    stored.ratingCount !== derived.ratingCount
  );
}

/**
 * Writes an aggregate.
 *
 * Deliberately **not exported for general use** — `products.service.ts` is the
 * only application caller, because Catalog owning this write is the entire
 * point of `ADR-0008`. The seed script uses it because a seed is not an
 * application path, and pointing it here is what stops it drifting from the
 * derivation it is meant to reproduce (§7.8).
 */
export async function writeRating(
  client: RatingClient,
  productId: string,
  aggregate: RatingAggregate,
): Promise<void> {
  await client.product.update({
    where: { id: productId },
    data: { avgRating: aggregate.avgRating, ratingCount: aggregate.ratingCount },
  });
}
