import { ConflictException, NotFoundException } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { PrismaService } from '../../prisma/prisma.service';

type MockPrisma = {
  wishlist: { findUnique: jest.Mock; create: jest.Mock };
  wishlistItem: { create: jest.Mock; delete: jest.Mock };
};

function fakeWishlist(items: { id: string; variantId: string }[] = []) {
  return { id: 'wl-1', userId: 'u1', shareToken: 'token-1', items };
}

describe('WishlistService', () => {
  let prisma: MockPrisma;
  let service: WishlistService;

  beforeEach(() => {
    prisma = {
      wishlist: { findUnique: jest.fn(), create: jest.fn() },
      wishlistItem: { create: jest.fn(), delete: jest.fn() },
    };
    service = new WishlistService(prisma as unknown as PrismaService);
  });

  describe('getWishlist', () => {
    it('creates a wishlist with a random shareToken on first access', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(null);
      prisma.wishlist.create.mockResolvedValue(fakeWishlist());
      await service.getWishlist('u1');
      const data = prisma.wishlist.create.mock.calls[0][0].data;
      expect(data.userId).toBe('u1');
      expect(data.shareToken).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe('addItem', () => {
    it('is idempotent — returns the wishlist unchanged if the variant is already saved', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(fakeWishlist([{ id: 'wi-1', variantId: 'v1' }]));
      await service.addItem('u1', 'v1');
      expect(prisma.wishlistItem.create).not.toHaveBeenCalled();
    });

    it('creates a new item when the variant is not already saved', async () => {
      prisma.wishlist.findUnique.mockResolvedValueOnce(fakeWishlist()).mockResolvedValueOnce(fakeWishlist([{ id: 'wi-1', variantId: 'v1' }]));
      prisma.wishlistItem.create.mockResolvedValue({});
      await service.addItem('u1', 'v1');
      expect(prisma.wishlistItem.create).toHaveBeenCalledWith({ data: { wishlistId: 'wl-1', variantId: 'v1' } });
    });

    it('translates a unique-constraint violation (P2002) into ConflictException', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(fakeWishlist());
      prisma.wishlistItem.create.mockRejectedValue({ code: 'P2002' });
      await expect(service.addItem('u1', 'v1')).rejects.toThrow(ConflictException);
    });

    it('rethrows an unrelated database error rather than masking it as a conflict', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(fakeWishlist());
      prisma.wishlistItem.create.mockRejectedValue({ code: 'P9999', message: 'something else' });
      await expect(service.addItem('u1', 'v1')).rejects.toMatchObject({ code: 'P9999' });
    });
  });

  describe('removeItem', () => {
    it('throws NotFoundException when the variant is not saved', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(fakeWishlist());
      await expect(service.removeItem('u1', 'not-saved')).rejects.toThrow(NotFoundException);
    });

    it('deletes the matching item', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(fakeWishlist([{ id: 'wi-1', variantId: 'v1' }]));
      prisma.wishlistItem.delete.mockResolvedValue({});
      await service.removeItem('u1', 'v1');
      expect(prisma.wishlistItem.delete).toHaveBeenCalledWith({ where: { id: 'wi-1' } });
    });
  });

  describe('getByShareToken', () => {
    it('throws NotFoundException for an invalid token', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(null);
      await expect(service.getByShareToken('bad-token')).rejects.toThrow(NotFoundException);
    });

    it('exposes only the items, never the owning user/account details', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(fakeWishlist([{ id: 'wi-1', variantId: 'v1' }]));
      const result = await service.getByShareToken('token-1');
      expect(result).toEqual({ items: [{ id: 'wi-1', variantId: 'v1' }] });
      expect(result).not.toHaveProperty('userId');
    });
  });
});
