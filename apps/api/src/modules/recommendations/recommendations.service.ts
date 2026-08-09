import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OrderStatus, Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { RecommendationItem, ScoredRecommendationItem } from './recommendations.types';

export interface ViewIdentity {
  userId?: string;
  anonymousId?: string;
}

const TRENDING_WINDOW_DAYS = 14;
const TRENDING_CACHE_TTL_MS = 5 * 60 * 1000;
// How many of a viewer's own recent views/purchases to fan out from when
// building candidate sets — bounded so personalized/recently-viewed reads
// stay cheap regardless of how long a customer's history gets.
const HISTORY_FAN_OUT = 10;

const productSummaryInclude = {
  category: true,
  variants: true,
  media: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
};

type ProductSummary = Prisma.ProductGetPayload<{ include: typeof productSummaryInclude }>;

function toItem(product: ProductSummary): RecommendationItem {
  const prices = product.variants.map((v) => v.basePriceMinorUnits);
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    categorySlug: product.category.slug,
    priceMinMinorUnits: prices.length ? Math.min(...prices) : 0,
    avgRating: Number(product.avgRating),
    ratingCount: product.ratingCount,
    thumbnailRef: product.media[0]?.storageRef ?? null,
  };
}

/**
 * Rule-based, not a trained ML model — co-occurrence counting (Frequently
 * Bought Together), recency de-duplication (Recently Viewed), a recent-sales
 * window (Trending), and a category-affinity + co-occurrence blend
 * (Personalized) — see BACKEND.md §9 for why this is the right MVP scope
 * (FR-14/FR-15) versus a real collaborative-filtering/embedding model, which
 * has no training data or infra to support it yet.
 */
/**
 * How far back a newly registered account may claim guest views — the server's
 * expression of Invariant 9's "same session".
 *
 * A day rather than a typical 30-minute session window: someone can browse in
 * the morning and sign up in the evening from the same browser, and that is
 * plainly the same person. It is short enough to honour §8.6's "not a much
 * earlier visit".
 */
const GUEST_VIEW_CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class RecommendationsService implements OnModuleInit {
  private readonly logger = new Logger(RecommendationsService.name);
  private trendingCache: { expiresAt: number; items: RecommendationItem[] } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly settings: SettingsService,
  ) {}

  onModuleInit(): void {
    // Maintains ProductCoOccurrence incrementally rather than computing FBT
    // live — re-fetches the order's items from Postgres by id rather than
    // trusting the event payload, consistent with SearchService's listener.
    this.eventBus.on('order.confirmed', (payload) => this.recomputeCoOccurrence(payload.orderId));
  }

  // ── Recording ────────────────────────────────────────────────────────────

  async recordView(productId: string, identity: ViewIdentity): Promise<void> {
    if (!identity.userId && !identity.anonymousId) {
      // Best-effort telemetry — a guest with no client-generated id yet has
      // nothing to key the row on, so this is a silent no-op, not an error.
      return;
    }
    await this.prisma.productView.create({
      data: { productId, userId: identity.userId, anonymousId: identity.userId ? null : identity.anonymousId },
    });
  }

  /**
   * Transfers a guest's view history to the account they just created —
   * `DOM-RECOMMENDATION` Invariant 9, so first-session personalisation
   * survives sign-up.
   *
   * **Bounded in time, deliberately.** §8.6 says history transfers *"when it
   * is the same session"*, and that across sessions it does not: *"an
   * `anonymousId` from a different browser or a much earlier visit is not
   * claimable, since there is no basis to believe it is the same person."*
   *
   * The server has no session for a guest, so "same session" is expressed as a
   * recency window. Same *browser* is already guaranteed when the client sends
   * its own `localStorage` id — the window is what bounds a **forged** one.
   * An `anonymousId` is guessable only by being told it, but it travels in a
   * registration payload, and a claim with no time bound would let anyone who
   * learned one inherit another person's browsing history through the
   * recommendations it produces (Invariant 3 exists to keep views un-joinable
   * to a person; this keeps them un-transferable to the wrong one).
   *
   * Writes only this domain's own table, and takes the user id from the caller
   * rather than reading Identity's — Recommendation reads other contexts and
   * writes none of them (§7).
   *
   * @returns how many views were claimed, for the caller to log or ignore.
   */
  async claimGuestViews(userId: string, anonymousId: string): Promise<number> {
    const cutoff = new Date(Date.now() - GUEST_VIEW_CLAIM_WINDOW_MS);

    const { count } = await this.prisma.productView.updateMany({
      where: { anonymousId, viewedAt: { gte: cutoff } },
      // `anonymousId` is cleared in the same write: Invariant 2 is an XOR, and
      // a row carrying both would satisfy neither branch of it.
      data: { userId, anonymousId: null },
    });

    return count;
  }

  /**
   * Co-occurrence is otherwise only built going forward from new
   * `order.confirmed` events — any orders placed before this feature existed
   * (or before a fresh deploy replays history) contribute nothing until this
   * runs once. Wipes and rebuilds from full order history, so it's safe to
   * re-run any time, the same way SearchService.reindexAll is.
   */
  async backfillCoOccurrence(): Promise<{ ordersProcessed: number }> {
    await this.prisma.productCoOccurrence.deleteMany({});
    const orders = await this.prisma.order.findMany({
      where: { status: { not: OrderStatus.CANCELLED } },
      select: { id: true },
    });
    for (const order of orders) {
      await this.recomputeCoOccurrence(order.id);
    }
    return { ordersProcessed: orders.length };
  }

  private async recomputeCoOccurrence(orderId: string): Promise<void> {
    const items = await this.prisma.orderItem.findMany({
      where: { orderId },
      include: { variant: { select: { productId: true } } },
    });
    const productIds = Array.from(new Set(items.map((item) => item.variant.productId)));
    if (productIds.length < 2) {
      return;
    }

    for (let i = 0; i < productIds.length; i++) {
      for (let j = i + 1; j < productIds.length; j++) {
        const [productAId, productBId] = [productIds[i], productIds[j]].sort();
        await this.prisma.productCoOccurrence.upsert({
          where: { productAId_productBId: { productAId, productBId } },
          create: { productAId, productBId, coOccurrenceCount: 1 },
          update: { coOccurrenceCount: { increment: 1 } },
        });
      }
    }
  }

  // ── Recently Viewed ───────────────────────────────────────────────────────

  async getRecentlyViewed(identity: ViewIdentity, limit: number): Promise<RecommendationItem[]> {
    if (!identity.userId && !identity.anonymousId) {
      return [];
    }
    const views = await this.prisma.productView.findMany({
      where: identity.userId ? { userId: identity.userId } : { anonymousId: identity.anonymousId },
      orderBy: { viewedAt: 'desc' },
      take: limit * 5, // overfetch to de-dupe repeat views of the same product down to `limit`
      select: { productId: true },
    });

    const orderedDistinctIds: string[] = [];
    for (const view of views) {
      if (!orderedDistinctIds.includes(view.productId)) {
        orderedDistinctIds.push(view.productId);
      }
      if (orderedDistinctIds.length === limit) break;
    }
    return this.fetchPublishedInOrder(orderedDistinctIds);
  }

  // ── Frequently Bought Together ───────────────────────────────────────────

  /**
   * `DOM-RECOMMENDATION` Invariant 8: a pair is only recommendable at a
   * co-occurrence count at or above the threshold. Below it the pair is noise
   * — two people who happened to buy the same two things is not a pattern, and
   * a rail headed "frequently bought together" that fires on a single
   * co-purchase asserts something untrue (Law 1).
   *
   * The threshold is a **setting**, not a constant, because the invariant says
   * so in as many words: *"a starting heuristic to be tuned against real data,
   * not a tuned figure"*. Tuning it should not require a deploy.
   */
  async getFrequentlyBoughtTogether(productId: string, limit: number): Promise<RecommendationItem[]> {
    const minCoOccurrence = await this.settings.get('recommendations.min_co_occurrence');
    const pairs = await this.prisma.productCoOccurrence.findMany({
      where: {
        OR: [{ productAId: productId }, { productBId: productId }],
        coOccurrenceCount: { gte: minCoOccurrence },
      },
      orderBy: { coOccurrenceCount: 'desc' },
      take: limit,
    });
    const coOccurringIds = pairs.map((pair) => (pair.productAId === productId ? pair.productBId : pair.productAId));

    // Returned as-is, including empty. There used to be a cold-start fallback
    // here that topped the rail up with same-category bestsellers, and it
    // predates the decision that removed its justification.
    //
    // `DOM-RECOMMENDATION` §8.2 is explicit: with Invariant 8's minimum
    // support, *"the frequently-bought-together rail will correctly render
    // empty, and the UI must handle that rather than showing a broken
    // section."* Filling it with same-category products makes a heading that
    // says **frequently bought together** describe items nobody bought
    // together — which is Law 1, not a nicety, and it defeated the threshold
    // in practice: a noisy pair filtered out of the query came straight back
    // in through the fallback.
    //
    // The product page already carries a separate popularity-based rail for
    // exactly this cold-start purpose, under a heading that does not claim
    // co-purchase.
    return this.fetchPublishedInOrder(coOccurringIds);
  }

  // ── Trending ──────────────────────────────────────────────────────────────

  async getTrending(limit: number): Promise<RecommendationItem[]> {
    if (this.trendingCache && this.trendingCache.expiresAt > Date.now()) {
      return this.trendingCache.items.slice(0, limit);
    }

    const items = await this.computeTrending(limit);
    // Cached at the broadest limit any caller is likely to request — short
    // TTL in-memory cache is the documented interim substitute for Redis
    // (no caching layer yet, per BACKEND.md's gap table); fine for a single
    // API instance, would need to move to Redis once there's more than one.
    this.trendingCache = { items, expiresAt: Date.now() + TRENDING_CACHE_TTL_MS };
    return items.slice(0, limit);
  }

  private async computeTrending(limit: number): Promise<RecommendationItem[]> {
    const cutoff = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const grouped = await this.prisma.orderItem.groupBy({
      by: ['variantId'],
      where: { order: { createdAt: { gte: cutoff }, status: { not: OrderStatus.CANCELLED } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit * 6, // several variants can map to the same product; overfetch before collapsing
    });

    if (grouped.length === 0) {
      return this.getBestsellers(limit);
    }

    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: grouped.map((g) => g.variantId) } },
      select: { id: true, productId: true },
    });
    const variantToProduct = new Map(variants.map((v) => [v.id, v.productId]));

    const salesByProduct = new Map<string, number>();
    for (const group of grouped) {
      const productId = variantToProduct.get(group.variantId);
      if (!productId) continue;
      salesByProduct.set(productId, (salesByProduct.get(productId) ?? 0) + (group._sum.quantity ?? 0));
    }

    const rankedIds = [...salesByProduct.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    const items = await this.fetchPublishedInOrder(rankedIds.slice(0, limit * 2));
    if (items.length >= limit) {
      return items.slice(0, limit);
    }
    // Recent sales exist but didn't yield enough published items (e.g. some
    // sold products were since unpublished) — top up with bestsellers.
    const fallback = await this.getBestsellers(limit, items.map((i) => i.productId));
    return [...items, ...fallback].slice(0, limit);
  }

  private async getBestsellers(limit: number, excludeIds: string[] = []): Promise<RecommendationItem[]> {
    const products = await this.prisma.product.findMany({
      where: { status: ProductStatus.PUBLISHED, deletedAt: null, id: { notIn: excludeIds } },
      include: productSummaryInclude,
      orderBy: [{ ratingCount: 'desc' }, { avgRating: 'desc' }],
      take: limit,
    });
    return products.map(toItem);
  }

  // ── Personalized ──────────────────────────────────────────────────────────

  async getPersonalized(userId: string, limit: number): Promise<ScoredRecommendationItem[]> {
    const purchasedItems = await this.prisma.orderItem.findMany({
      where: { order: { userId, status: { not: OrderStatus.CANCELLED } } },
      include: { variant: { select: { productId: true, product: { select: { categoryId: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_FAN_OUT * 4,
    });

    if (purchasedItems.length === 0) {
      // Cold start: a new user has no purchase history to personalize from.
      const trending = await this.getTrending(limit);
      return trending.map((item) => ({ ...item, reason: 'trending' as const }));
    }

    const purchasedProductIds = new Set(purchasedItems.map((item) => item.variant.productId));
    const categoryIds = new Set(purchasedItems.map((item) => item.variant.product.categoryId));
    const recentPurchasedIds = [...purchasedProductIds].slice(0, HISTORY_FAN_OUT);

    const scored = new Map<string, { score: number; reason: ScoredRecommendationItem['reason'] }>();

    // Same threshold as Frequently Bought Together — Invariant 8 is about the
    // pair being meaningful, not about which rail is asking.
    const minCoOccurrence = await this.settings.get('recommendations.min_co_occurrence');
    const coOccurrences = await this.prisma.productCoOccurrence.findMany({
      where: {
        OR: [{ productAId: { in: recentPurchasedIds } }, { productBId: { in: recentPurchasedIds } }],
        coOccurrenceCount: { gte: minCoOccurrence },
      },
      orderBy: { coOccurrenceCount: 'desc' },
      take: limit * 4,
    });
    for (const pair of coOccurrences) {
      const otherId = recentPurchasedIds.includes(pair.productAId) ? pair.productBId : pair.productAId;
      if (purchasedProductIds.has(otherId)) continue;
      const existing = scored.get(otherId);
      if (!existing || pair.coOccurrenceCount > existing.score) {
        scored.set(otherId, { score: pair.coOccurrenceCount, reason: 'co_purchased' });
      }
    }

    if (scored.size < limit) {
      const categoryMatches = await this.prisma.product.findMany({
        where: {
          categoryId: { in: [...categoryIds] },
          status: ProductStatus.PUBLISHED,
          deletedAt: null,
          id: { notIn: [...purchasedProductIds, ...scored.keys()] },
        },
        orderBy: { ratingCount: 'desc' },
        take: limit * 2,
        select: { id: true, ratingCount: true },
      });
      // Scored on the same axis as co-occurrence count but deliberately kept
      // low (a fraction of ratingCount) — a co-purchase signal from this
      // specific user's own history should outrank a generic category match.
      for (const product of categoryMatches) {
        if (!scored.has(product.id)) {
          scored.set(product.id, { score: product.ratingCount * 0.1, reason: 'category_affinity' });
        }
      }
    }

    const rankedIds = [...scored.entries()].sort((a, b) => b[1].score - a[1].score).map(([id]) => id);
    const products = await this.fetchPublishedInOrder(rankedIds.slice(0, limit));
    const reasonById = new Map(rankedIds.map((id) => [id, scored.get(id)!.reason]));
    const result: ScoredRecommendationItem[] = products.map((item) => ({
      ...item,
      reason: reasonById.get(item.productId) ?? 'category_affinity',
    }));

    if (result.length < limit) {
      const exclude = [...purchasedProductIds, ...result.map((i) => i.productId)];
      const trending = await this.getTrending(limit);
      const topUp = trending
        .filter((item) => !exclude.includes(item.productId))
        .slice(0, limit - result.length)
        .map((item) => ({ ...item, reason: 'trending' as const }));
      return [...result, ...topUp];
    }
    return result;
  }

  // ── Shared helpers ────────────────────────────────────────────────────────

  private async fetchPublishedInOrder(productIds: string[]): Promise<RecommendationItem[]> {
    if (productIds.length === 0) return [];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, status: ProductStatus.PUBLISHED, deletedAt: null },
      include: productSummaryInclude,
    });
    const byId = new Map(products.map((p) => [p.id, toItem(p)]));
    return productIds.map((id) => byId.get(id)).filter((item): item is RecommendationItem => Boolean(item));
  }
}
