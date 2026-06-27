import { Injectable } from '@nestjs/common';
import { ModerationStatus, OrderStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { DashboardSummary, TopProduct } from './analytics.types';

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

    const [orders, statusGroups, lowStock, pendingReviewsCount, newCustomers] = await Promise.all([
      this.prisma.order.findMany({
        where: { createdAt: { gte: cutoff }, ...nonCancelled },
        select: { totalMinorUnits: true },
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

    const revenueMinorUnits = orders.reduce((sum, o) => sum + o.totalMinorUnits, 0);
    const orderCount = orders.length;
    const ordersByStatus: Record<string, number> = {};
    for (const group of statusGroups) {
      ordersByStatus[group.status] = group._count._all;
    }

    return {
      windowDays,
      revenueMinorUnits,
      orderCount,
      averageOrderValueMinorUnits: orderCount > 0 ? Math.round(revenueMinorUnits / orderCount) : 0,
      ordersByStatus,
      topProducts: await this.getTopProducts(cutoff),
      lowStockCount: lowStock.length,
      pendingReviewsCount,
      newCustomers,
    };
  }

  private async getTopProducts(cutoff: Date): Promise<TopProduct[]> {
    const items = await this.prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: cutoff }, status: { not: OrderStatus.CANCELLED } } },
      select: {
        quantity: true,
        unitPriceMinorUnits: true,
        productNameSnapshot: true,
        variant: { select: { productId: true } },
      },
    });

    const byProduct = new Map<string, TopProduct>();
    for (const item of items) {
      const productId = item.variant.productId;
      const existing = byProduct.get(productId);
      const revenue = item.quantity * item.unitPriceMinorUnits;
      if (existing) {
        existing.unitsSold += item.quantity;
        existing.revenueMinorUnits += revenue;
      } else {
        byProduct.set(productId, {
          productId,
          name: item.productNameSnapshot,
          unitsSold: item.quantity,
          revenueMinorUnits: revenue,
        });
      }
    }

    return [...byProduct.values()].sort((a, b) => b.revenueMinorUnits - a.revenueMinorUnits).slice(0, TOP_PRODUCTS_LIMIT);
  }
}
