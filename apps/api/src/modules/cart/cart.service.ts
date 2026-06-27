import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';

const cartInclude = {
  items: {
    include: { variant: { include: { product: true } } },
  },
} as const;

/**
 * Persisted server-side cart — closes the gap named in BACKEND.md §4 ("no
 * Cart module ... no cross-device cart persistence"). This is additive, not
 * a breaking change: `OrdersService.create` still accepts a flat `items[]`
 * array directly (FRONTEND.md's local cart already submits that shape), so
 * existing checkout integration is untouched. A client can now *optionally*
 * sync its cart here for cross-device persistence before checkout.
 */
@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreateCart(userId: string) {
    const existing = await this.prisma.cart.findUnique({ where: { userId }, include: cartInclude });
    if (existing) return existing;
    return this.prisma.cart.create({ data: { userId }, include: cartInclude });
  }

  async getCart(userId: string) {
    return this.getOrCreateCart(userId);
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      include: { product: true },
    });
    if (!variant || variant.product.status !== ProductStatus.PUBLISHED || variant.product.deletedAt) {
      throw new BadRequestException('This item is not available for purchase');
    }

    const cart = await this.getOrCreateCart(userId);
    const existingItem = cart.items.find((item) => item.variantId === dto.variantId);

    if (existingItem) {
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + dto.quantity, giftWrap: dto.giftWrap ?? existingItem.giftWrap },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId: dto.variantId,
          quantity: dto.quantity,
          priceSnapshotMinorUnits: variant.basePriceMinorUnits,
          giftWrap: dto.giftWrap ?? false,
        },
      });
    }

    return this.getCart(userId);
  }

  async updateItemQuantity(userId: string, variantId: string, quantity: number) {
    const cart = await this.getOrCreateCart(userId);
    const item = cart.items.find((i) => i.variantId === variantId);
    if (!item) {
      throw new NotFoundException('This item is not in your cart');
    }
    await this.prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
    return this.getCart(userId);
  }

  async removeItem(userId: string, variantId: string) {
    const cart = await this.getOrCreateCart(userId);
    const item = cart.items.find((i) => i.variantId === variantId);
    if (!item) {
      throw new NotFoundException('This item is not in your cart');
    }
    await this.prisma.cartItem.delete({ where: { id: item.id } });
    return this.getCart(userId);
  }

  async clear(userId: string): Promise<void> {
    const cart = await this.getOrCreateCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }
}
