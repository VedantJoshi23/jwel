import { ConflictException, Injectable } from '@nestjs/common';
import { ModerationStatus, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { PaginatedResult, PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(userId: string, dto: CreateReviewDto) {
    const existing = await this.prisma.review.findUnique({
      where: { productId_userId: { productId: dto.productId, userId } },
    });
    if (existing) {
      throw new ConflictException('You have already reviewed this product');
    }

    const verifiedPurchase = await this.hasDeliveredOrder(userId, dto.productId);

    // Decision carried from PRODUCT.md §11 (open question, resolved here): ship
    // unmoderated-at-write, manual-moderation-queue — review is created PENDING
    // and excluded from public listing/rating aggregate until an admin approves it.
    return this.prisma.review.create({
      data: { ...dto, userId, verifiedPurchase, moderationStatus: ModerationStatus.PENDING },
    });
  }

  private async hasDeliveredOrder(userId: string, productId: string): Promise<boolean> {
    const count = await this.prisma.orderItem.count({
      where: {
        order: { userId, status: OrderStatus.DELIVERED },
        variant: { productId },
      },
    });
    return count > 0;
  }

  async listForProduct(productId: string, query: PaginationQueryDto): Promise<PaginatedResult<any>> {
    const { page, pageSize } = query;
    const where: Prisma.ReviewWhereInput = { productId, moderationStatus: ModerationStatus.APPROVED };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, page, pageSize, total };
  }

  adminListPending(query: PaginationQueryDto) {
    const { page, pageSize } = query;
    return this.prisma.review.findMany({
      where: { moderationStatus: ModerationStatus.PENDING },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'asc' },
    });
  }

  async adminModerate(id: string, status: ModerationStatus) {
    const review = await this.prisma.review.update({ where: { id }, data: { moderationStatus: status } });
    await this.recomputeProductRating(review.productId);
    // Rating/ratingCount feed directly into search ranking's popularity
    // signal (search.service.ts's field_value_factor on ratingCount) — a
    // moderation decision must reindex, not just update Postgres.
    this.eventBus.emit('product.upserted', { productId: review.productId });
    return review;
  }

  // Write-through aggregate update (DATABASE.md §3 `products` notes) — avoids
  // computing AVG/COUNT over reviews on every PLP/PDP read.
  private async recomputeProductRating(productId: string): Promise<void> {
    const aggregate = await this.prisma.review.aggregate({
      where: { productId, moderationStatus: ModerationStatus.APPROVED },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        avgRating: aggregate._avg.rating ?? 0,
        ratingCount: aggregate._count.rating,
      },
    });
  }
}
