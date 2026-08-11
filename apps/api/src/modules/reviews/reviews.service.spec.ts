import { ConflictException, NotFoundException } from '@nestjs/common';
import { ModerationStatus } from '@prisma/client';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from '../products/products.service';

type MockPrisma = {
  review: { findUnique: jest.Mock; create: jest.Mock; findMany: jest.Mock; count: jest.Mock; update: jest.Mock; aggregate: jest.Mock };
  orderItem: { count: jest.Mock };
  product: { update: jest.Mock };
  $transaction: jest.Mock;
};

describe('ReviewsService', () => {
  let prisma: MockPrisma;
  let products: { withRatingRecompute: jest.Mock };
  let service: ReviewsService;

  beforeEach(() => {
    prisma = {
      review: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn(), aggregate: jest.fn() },
      orderItem: { count: jest.fn() },
      product: { update: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    products = {
      // Stands in for Catalog: runs the caller's work against a transaction
      // client, exactly as the real implementation does.
      withRatingRecompute: jest.fn((_productId, work) => work(prisma)),
    };
    service = new ReviewsService(
      prisma as unknown as PrismaService,
      products as unknown as ProductsService,
    );
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

  describe('findMine — FEAT-PENDING-REVIEW-VISIBILITY', () => {
    it('looks up by the unique (productId, userId) pair, not a filtered list', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'r1', moderationStatus: ModerationStatus.PENDING });
      const result = await service.findMine('u1', 'p1');
      expect(prisma.review.findUnique).toHaveBeenCalledWith({
        where: { productId_userId: { productId: 'p1', userId: 'u1' } },
      });
      expect(result).toMatchObject({ id: 'r1' });
    });

    it('returns null rather than throwing when the caller has not reviewed this product — the controller decides what that means, not the service', async () => {
      prisma.review.findUnique.mockResolvedValue(null);
      await expect(service.findMine('u1', 'p1')).resolves.toBeNull();
    });

    it('is not filtered by moderationStatus — a PENDING or REJECTED review must still come back to its own author', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'r1', moderationStatus: ModerationStatus.REJECTED });
      const result = await service.findMine('u1', 'p1');
      expect(result).toMatchObject({ moderationStatus: ModerationStatus.REJECTED });
    });
  });

  describe('adminListPending — FEAT-ADMIN-REVIEW-MODERATION', () => {
    it('lists only PENDING reviews, oldest first', async () => {
      prisma.review.findMany.mockResolvedValue([]);
      await service.adminListPending({ page: 1, pageSize: 10 });
      expect(prisma.review.findMany).toHaveBeenCalledWith({
        where: { moderationStatus: ModerationStatus.PENDING },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'asc' },
        include: {
          product: { select: { id: true, name: true, slug: true } },
          user: { select: { id: true, email: true, name: true } },
        },
      });
    });

    it('includes the product name and reviewer email — a moderator cannot decide on a raw productId/userId pair', async () => {
      prisma.review.findMany.mockResolvedValue([
        {
          id: 'r1',
          product: { id: 'p1', name: 'Diamond Halo Ring', slug: 'diamond-halo-ring' },
          user: { id: 'u1', email: 'customer@example.com', name: null },
        },
      ]);
      const result = await service.adminListPending({ page: 1, pageSize: 10 });
      expect(result[0]).toMatchObject({
        product: { name: 'Diamond Halo Ring' },
        user: { email: 'customer@example.com' },
      });
    });
  });

  describe('adminModerate — ADR-0008, the boundary this closed', () => {
    it('commands Catalog to recompute rather than writing the product itself', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'r1', productId: 'p1' });
      prisma.review.update.mockResolvedValue({ id: 'r1', productId: 'p1' });

      await service.adminModerate('r1', ModerationStatus.APPROVED);

      expect(products.withRatingRecompute).toHaveBeenCalledWith('p1', expect.any(Function));
    });

    it('never writes prisma.product — the violation KC-152 recorded', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'r1', productId: 'p1' });
      prisma.review.update.mockResolvedValue({ id: 'r1', productId: 'p1' });

      await service.adminModerate('r1', ModerationStatus.APPROVED);

      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('performs the moderation write inside Catalog\'s transaction (§3.5)', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'r1', productId: 'p1' });
      prisma.review.update.mockResolvedValue({ id: 'r1', productId: 'p1' });

      // The stub only invokes the callback; if the update happened outside it,
      // a failing recompute could not roll the approval back.
      let updatedInsideCallback = false;
      products.withRatingRecompute.mockImplementation(async (_id, work) => {
        expect(prisma.review.update).not.toHaveBeenCalled();
        const result = await work(prisma);
        updatedInsideCallback = prisma.review.update.mock.calls.length === 1;
        return result;
      });

      await service.adminModerate('r1', ModerationStatus.APPROVED);
      expect(updatedInsideCallback).toBe(true);
    });

    it('returns the updated review', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'r1', productId: 'p1' });
      prisma.review.update.mockResolvedValue({ id: 'r1', moderationStatus: 'APPROVED' });

      await expect(service.adminModerate('r1', ModerationStatus.APPROVED)).resolves.toMatchObject({
        moderationStatus: 'APPROVED',
      });
    });

    it('404s on an unknown review without touching Catalog', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(service.adminModerate('nope', ModerationStatus.APPROVED)).rejects.toThrow(
        NotFoundException,
      );
      expect(products.withRatingRecompute).not.toHaveBeenCalled();
    });
  });
});
