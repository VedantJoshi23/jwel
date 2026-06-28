import { ConflictException } from '@nestjs/common';
import { ModerationStatus } from '@prisma/client';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../common/event-bus/event-bus.service';

type MockPrisma = {
  review: { findUnique: jest.Mock; create: jest.Mock; findMany: jest.Mock; count: jest.Mock; update: jest.Mock; aggregate: jest.Mock };
  orderItem: { count: jest.Mock };
  product: { update: jest.Mock };
  $transaction: jest.Mock;
};

describe('ReviewsService', () => {
  let prisma: MockPrisma;
  let eventBus: { emit: jest.Mock };
  let service: ReviewsService;

  beforeEach(() => {
    prisma = {
      review: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn(), aggregate: jest.fn() },
      orderItem: { count: jest.fn() },
      product: { update: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    eventBus = { emit: jest.fn() };
    service = new ReviewsService(prisma as unknown as PrismaService, eventBus as unknown as EventBusService);
  });

  describe('create', () => {
    it('throws ConflictException when the user already reviewed this product', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.create('u1', { productId: 'p1', rating: 5, body: 'great' } as any)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.review.create).not.toHaveBeenCalled();
    });

    it('marks verifiedPurchase true when the user has a DELIVERED order containing this product', async () => {
      prisma.review.findUnique.mockResolvedValue(null);
      prisma.orderItem.count.mockResolvedValue(1);
      prisma.review.create.mockResolvedValue({});

      await service.create('u1', { productId: 'p1', rating: 5, body: 'great' } as any);

      expect(prisma.review.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ verifiedPurchase: true }) }),
      );
    });

    it('marks verifiedPurchase false when there is no matching delivered order', async () => {
      prisma.review.findUnique.mockResolvedValue(null);
      prisma.orderItem.count.mockResolvedValue(0);
      prisma.review.create.mockResolvedValue({});

      await service.create('u1', { productId: 'p1', rating: 5, body: 'great' } as any);

      expect(prisma.review.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ verifiedPurchase: false }) }),
      );
    });

    it('always creates a new review as PENDING, regardless of verified-purchase status', async () => {
      prisma.review.findUnique.mockResolvedValue(null);
      prisma.orderItem.count.mockResolvedValue(1);
      prisma.review.create.mockResolvedValue({});

      await service.create('u1', { productId: 'p1', rating: 5, body: 'great' } as any);

      expect(prisma.review.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ moderationStatus: ModerationStatus.PENDING }) }),
      );
    });
  });

  describe('listForProduct', () => {
    it('only returns APPROVED reviews', async () => {
      prisma.review.findMany.mockResolvedValue([]);
      prisma.review.count.mockResolvedValue(0);
      await service.listForProduct('p1', { page: 1, pageSize: 10 });
      expect(prisma.review.findMany.mock.calls[0][0].where).toEqual({
        productId: 'p1',
        moderationStatus: ModerationStatus.APPROVED,
      });
    });
  });

  describe('adminListPending', () => {
    it('lists only PENDING reviews, oldest first', async () => {
      prisma.review.findMany.mockResolvedValue([]);
      await service.adminListPending({ page: 1, pageSize: 10 });
      expect(prisma.review.findMany).toHaveBeenCalledWith({
        where: { moderationStatus: ModerationStatus.PENDING },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('adminModerate', () => {
    it('recomputes the product rating aggregate and emits product.upserted', async () => {
      prisma.review.update.mockResolvedValue({ id: 'r1', productId: 'p1' });
      prisma.review.aggregate.mockResolvedValue({ _avg: { rating: 4.5 }, _count: { rating: 3 } });
      prisma.product.update.mockResolvedValue({});

      await service.adminModerate('r1', ModerationStatus.APPROVED);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { avgRating: 4.5, ratingCount: 3 },
      });
      expect(eventBus.emit).toHaveBeenCalledWith('product.upserted', { productId: 'p1' });
    });

    it('defaults avgRating to 0 when there are no approved reviews left (e.g. the only one was just rejected)', async () => {
      prisma.review.update.mockResolvedValue({ id: 'r1', productId: 'p1' });
      prisma.review.aggregate.mockResolvedValue({ _avg: { rating: null }, _count: { rating: 0 } });
      prisma.product.update.mockResolvedValue({});

      await service.adminModerate('r1', ModerationStatus.REJECTED);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { avgRating: 0, ratingCount: 0 },
      });
    });
  });
});
