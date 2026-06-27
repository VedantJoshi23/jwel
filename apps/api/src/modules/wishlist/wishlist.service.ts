import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

const wishlistInclude = {
  items: { include: { variant: { include: { product: true } } } },
} as const;

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreateWishlist(userId: string) {
    const existing = await this.prisma.wishlist.findUnique({ where: { userId }, include: wishlistInclude });
    if (existing) return existing;
    return this.prisma.wishlist.create({
      data: { userId, shareToken: randomBytes(16).toString('hex') },
      include: wishlistInclude,
    });
  }

  getWishlist(userId: string) {
    return this.getOrCreateWishlist(userId);
  }

  async addItem(userId: string, variantId: string) {
    const wishlist = await this.getOrCreateWishlist(userId);
    const alreadySaved = wishlist.items.some((item) => item.variantId === variantId);
    if (alreadySaved) {
      return wishlist;
    }
    try {
      await this.prisma.wishlistItem.create({ data: { wishlistId: wishlist.id, variantId } });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('This item is already in your wishlist');
      }
      throw error;
    }
    return this.getWishlist(userId);
  }

  async removeItem(userId: string, variantId: string) {
    const wishlist = await this.getOrCreateWishlist(userId);
    const item = wishlist.items.find((i) => i.variantId === variantId);
    if (!item) {
      throw new NotFoundException('This item is not in your wishlist');
    }
    await this.prisma.wishlistItem.delete({ where: { id: item.id } });
    return this.getWishlist(userId);
  }

  // Public, unauthenticated read — backs the "share wishlist via WhatsApp"
  // journey from PRODUCT.md Journey A / DESIGN.md §5.7. The token is the only
  // credential; no account details beyond the saved items are exposed.
  async getByShareToken(shareToken: string) {
    const wishlist = await this.prisma.wishlist.findUnique({ where: { shareToken }, include: wishlistInclude });
    if (!wishlist) {
      throw new NotFoundException('This wishlist link is invalid or has expired');
    }
    return { items: wishlist.items };
  }
}
