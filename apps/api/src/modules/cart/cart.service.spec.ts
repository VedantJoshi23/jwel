import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { CartService } from './cart.service';
import { PrismaService } from '../../prisma/prisma.service';

type MockPrisma = {
  cart: { findUnique: jest.Mock; create: jest.Mock };
  cartItem: { update: jest.Mock; create: jest.Mock; delete: jest.Mock; deleteMany: jest.Mock };
  productVariant: { findUnique: jest.Mock };
};

function fakeCart(items: { id: string; variantId: string; quantity: number; giftWrap: boolean }[] = []) {
  return { id: 'cart-1', userId: 'u1', items };
}

describe('CartService', () => {
  let prisma: MockPrisma;
  let service: CartService;

  beforeEach(() => {
    prisma = {
      cart: { findUnique: jest.fn(), create: jest.fn() },
      cartItem: { update: jest.fn(), create: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
      productVariant: { findUnique: jest.fn() },
    };
    service = new CartService(prisma as unknown as PrismaService);
  });

  describe('getCart', () => {
    it('creates a cart on first access when none exists yet', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);
      prisma.cart.create.mockResolvedValue(fakeCart());
      await service.getCart('u1');
      expect(prisma.cart.create).toHaveBeenCalledWith(expect.objectContaining({ data: { userId: 'u1' } }));
    });

    it('returns the existing cart without creating a new one', async () => {
      prisma.cart.findUnique.mockResolvedValue(fakeCart());
      await service.getCart('u1');
      expect(prisma.cart.create).not.toHaveBeenCalled();
    });
  });

  describe('addItem', () => {
    it('rejects an item whose product is not PUBLISHED', async () => {
      prisma.productVariant.findUnique.mockResolvedValue({
        id: 'v1',
        basePriceMinorUnits: 1000,
        product: { status: ProductStatus.DRAFT, deletedAt: null },
      });
      await expect(service.addItem('u1', { variantId: 'v1', quantity: 1 } as any)).rejects.toThrow(BadRequestException);
    });

    it('rejects an item whose product has been soft-deleted', async () => {
      prisma.productVariant.findUnique.mockResolvedValue({
        id: 'v1',
        basePriceMinorUnits: 1000,
        product: { status: ProductStatus.PUBLISHED, deletedAt: new Date() },
      });
      await expect(service.addItem('u1', { variantId: 'v1', quantity: 1 } as any)).rejects.toThrow(BadRequestException);
    });

    it('rejects an item for a nonexistent variant', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(null);
      await expect(service.addItem('u1', { variantId: 'ghost', quantity: 1 } as any)).rejects.toThrow(BadRequestException);
    });

    it('creates a new cart item, snapshotting the current price, when the variant is not already in the cart', async () => {
      prisma.productVariant.findUnique.mockResolvedValue({
        id: 'v1',
        basePriceMinorUnits: 5000,
        product: { status: ProductStatus.PUBLISHED, deletedAt: null },
      });
      prisma.cart.findUnique.mockResolvedValue(fakeCart());
      prisma.cartItem.create.mockResolvedValue({});

      await service.addItem('u1', { variantId: 'v1', quantity: 2 } as any);

      expect(prisma.cartItem.create).toHaveBeenCalledWith({
        data: { cartId: 'cart-1', variantId: 'v1', quantity: 2, priceSnapshotMinorUnits: 5000, giftWrap: false },
      });
    });

    it('increments quantity (does not duplicate the row) when the variant is already in the cart', async () => {
      prisma.productVariant.findUnique.mockResolvedValue({
        id: 'v1',
        basePriceMinorUnits: 5000,
        product: { status: ProductStatus.PUBLISHED, deletedAt: null },
      });
      prisma.cart.findUnique.mockResolvedValue(fakeCart([{ id: 'item-1', variantId: 'v1', quantity: 1, giftWrap: false }]));
      prisma.cartItem.update.mockResolvedValue({});

      await service.addItem('u1', { variantId: 'v1', quantity: 2 } as any);

      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { quantity: 3, giftWrap: false },
      });
      expect(prisma.cartItem.create).not.toHaveBeenCalled();
    });
  });

  describe('updateItemQuantity', () => {
    it('throws NotFoundException when the variant is not in the cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(fakeCart());
      await expect(service.updateItemQuantity('u1', 'not-in-cart', 2)).rejects.toThrow(NotFoundException);
    });

    it('updates the quantity for an item that is in the cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(fakeCart([{ id: 'item-1', variantId: 'v1', quantity: 1, giftWrap: false }]));
      prisma.cartItem.update.mockResolvedValue({});
      await service.updateItemQuantity('u1', 'v1', 5);
      expect(prisma.cartItem.update).toHaveBeenCalledWith({ where: { id: 'item-1' }, data: { quantity: 5 } });
    });
  });

  describe('removeItem', () => {
    it('throws NotFoundException when the variant is not in the cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(fakeCart());
      await expect(service.removeItem('u1', 'not-in-cart')).rejects.toThrow(NotFoundException);
    });

    it('deletes the matching cart item', async () => {
      prisma.cart.findUnique.mockResolvedValue(fakeCart([{ id: 'item-1', variantId: 'v1', quantity: 1, giftWrap: false }]));
      prisma.cartItem.delete.mockResolvedValue({});
      await service.removeItem('u1', 'v1');
      expect(prisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
    });
  });

  describe('clear', () => {
    it('deletes every item belonging to the cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(fakeCart());
      await service.clear('u1');
      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: 'cart-1' } });
    });
  });
});
