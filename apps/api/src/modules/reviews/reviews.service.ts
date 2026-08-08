import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ModerationStatus, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { PaginatedResult, PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ProductsService } from '../products/products.service';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
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

  /**
   * Moderating a review changes a product's rating aggregate — which Reviews
   * does not own.
   *
   * This method used to write `prisma.product` itself and emit
   * `product.upserted`, the system's one boundary violation (KC-152,
   * `ARCH-001` §1.3). Per `ADR-0008` it now **commands Catalog** and lets
   * Catalog own the write, the recompute and the emission.
   *
   * The moderation write goes inside Catalog's transaction rather than before
   * it, so a failed recompute takes the approval down with it. That coupling
   * is intended: a review approved whose rating did not move is the desync the
   * ADR exists to prevent.
   */
  async adminModerate(id: string, status: ModerationStatus) {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Review not found');
    }

    return this.products.withRatingRecompute(existing.productId, (tx) =>
      tx.review.update({ where: { id }, data: { moderationStatus: status } }),
    );
  }
}
