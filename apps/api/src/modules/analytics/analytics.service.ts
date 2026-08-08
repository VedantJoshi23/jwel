import { Injectable } from '@nestjs/common';
import { ModerationStatus, OrderStatus, ReturnStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { DashboardSummary, TopProduct } from './analytics.types';
import { averageOrderValue, computeRevenue } from './revenue';

const DEFAULT_WINDOW_DAYS = 30;
const TOP_PRODUCTS_LIMIT = 5;

/**
 * Everything here is computed live against Postgres on every request — no
 * materialized views, no scheduled refresh job. DATABASE.md §7.3 already
 * names `mv_daily_sales`/`mv_product_performance` as the recommended,
 * not-yet-created path for sub-100ms dashboard reads at real scale; this is
 * the documented interim, consistent with how Search/Recommendations also
 * compute their non-precomputed surfaces on read rather than adding
 * scheduling infra that doesn't exist yet in this stack.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async getDashboardSummary(windowDays: number = DEFAULT_WINDOW_DAYS): Promise<DashboardSummary> {
    const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const nonCancelled = { status: { not: OrderStatus.CANCELLED } } as const;

    const [orders, refundAggregate, statusGroups, lowStock, pendingReviewsCount, newCustomers] =
      await Promise.all([
      this.prisma.order.findMany({
        where: { createdAt: { gte: cutoff }, ...nonCancelled },
        select: { totalMinorUnits: true },
      }),
      // Refunds are scoped to the **orders** in this window, not to when the
      // refund was granted. That keeps the three figures describing one cohort,
      // so `net = gross - refunds` holds for the same set of orders the
      // order count and AOV describe.
      //
      // The consequence, worth knowing: a refund granted today against last
      // month's order moves *last month's* net, so a past window's figures can
      // change. A cash-flow view — money that left the account this month —
      // is a different report, and would scope by the return's own date.
      this.prisma.returnRequest.aggregate({
        where: {
          status: ReturnStatus.REFUNDED,
          orderItem: { order: { createdAt: { gte: cutoff }, ...nonCancelled } },
        },
        _sum: { refundAmountMinorUnits: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { createdAt: { gte: cutoff } },
        _count: { _all: true },
      }),
      this.inventory.listLowStock() as Promise<unknown[]>,
      this.prisma.review.count({ where: { moderationStatus: ModerationStatus.PENDING } }),
      this.prisma.user.count({ where: { role: Role.CUSTOMER, deletedAt: null, createdAt: { gte: cutoff } } }),
    ]);

    const revenue = computeRevenue(
      orders.reduce((sum, o) => sum + o.totalMinorUnits, 0),
      refundAggregate._sum.refundAmountMinorUnits ?? 0,
    );
    const orderCount = orders.length;
    const ordersByStatus: Record<string, number> = {};
    for (const group of statusGroups) {
      ordersByStatus[group.status] = group._count._all;
    }

    return {
      windowDays,
      ...revenue,
      orderCount,
      averageOrderValueMinorUnits: averageOrderValue(revenue.grossMinorUnits, orderCount),
      ordersByStatus,
      topProducts: await this.getTopProducts(cutoff),
      lowStockCount: lowStock.length,
      pendingReviewsCount,
      newCustomers,
    };
  }

  /**
   * Top products by **net** contribution.
   *
   * Ranking on gross would put a heavily-returned product at the top of the
   * list an admin uses to decide what to restock and promote — the one place
   * where ignoring returns does active harm rather than merely overstating a
   * total. Invariant 3 applies to any revenue figure, not only the headline.
   */
  private async getTopProducts(cutoff: Date): Promise<TopProduct[]> {
    const items = await this.prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: cutoff }, status: { not: OrderStatus.CANCELLED } } },
      select: {
        quantity: true,
        unitPriceMinorUnits: true,
        productNameSnapshot: true,
        variant: { select: { productId: true } },
        // 1:1 on order_items, so this rides along rather than costing a query
        // per item.
        returnRequest: { select: { status: true, refundAmountMinorUnits: true } },
      },
    });

    const byProduct = new Map<string, TopProduct>();
    for (const item of items) {
      const productId = item.variant.productId;
      const gross = item.quantity * item.unitPriceMinorUnits;
      const refunded =
        item.returnRequest?.status === ReturnStatus.REFUNDED
          ? (item.returnRequest.refundAmountMinorUnits ?? 0)
          : 0;

      const existing = byProduct.get(productId);
      if (existing) {
        existing.unitsSold += item.quantity;
        existing.grossMinorUnits += gross;
        existing.refundsMinorUnits += refunded;
        existing.netMinorUnits += gross - refunded;
      } else {
        byProduct.set(productId, {
          productId,
          name: item.productNameSnapshot,
          // Units *sold*, not units kept. Deducting returned units here would
          // conflate two questions — how much moved, and how much stayed sold.
          unitsSold: item.quantity,
          grossMinorUnits: gross,
          refundsMinorUnits: refunded,
          netMinorUnits: gross - refunded,
        });
      }
    }

    return [...byProduct.values()]
      .sort((a, b) => b.netMinorUnits - a.netMinorUnits)
      .slice(0, TOP_PRODUCTS_LIMIT);
  }
}
