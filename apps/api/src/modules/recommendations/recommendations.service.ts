import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OrderStatus, Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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
@Injectable()
export class RecommendationsService implements OnModuleInit {
  private readonly logger = new Logger(RecommendationsService.name);
  private trendingCache: { expiresAt: number; items: RecommendationItem[] } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
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

  async getFrequentlyBoughtTogether(productId: string, limit: number): Promise<RecommendationItem[]> {
    const pairs = await this.prisma.productCoOccurrence.findMany({
      where: { OR: [{ productAId: productId }, { productBId: productId }] },
      orderBy: { coOccurrenceCount: 'desc' },
      take: limit,
    });
    const coOccurringIds = pairs.map((pair) => (pair.productAId === productId ? pair.productBId : pair.productAId));
    const items = await this.fetchPublishedInOrder(coOccurringIds);

    if (items.length >= limit) {
      return items;
    }

    // Cold start for a product with little/no purchase history yet: fill
    // remaining slots with same-category bestsellers rather than returning
    // a half-empty (or empty) "frequently bought together" rail.
    const self = await this.prisma.product.findUnique({ where: { id: productId }, select: { categoryId: true } });
    if (!self) return items;

    const excludeIds = [productId, ...items.map((i) => i.productId)];
    const fallback = await this.prisma.product.findMany({
      where: { categoryId: self.categoryId, status: ProductStatus.PUBLISHED, deletedAt: null, id: { notIn: excludeIds } },
      include: productSummaryInclude,
      orderBy: { ratingCount: 'desc' },
      take: limit - items.length,
    });
    return [...items, ...fallback.map(toItem)];
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

    const coOccurrences = await this.prisma.productCoOccurrence.findMany({
      where: { OR: [{ productAId: { in: recentPurchasedIds } }, { productBId: { in: recentPurchasedIds } }] },
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
