import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CreateCartShareDto } from './dto/create-cart-share.dto';

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

  // ────────────────────────────────────────────────────────────────────────
  // SHAREABLE CART — DOM-SHOPPING Invariants 9, 11 and 16
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Freezes a set of cart lines and returns the token that opens them.
   *
   * **The lines come from the client**, which reads oddly for an API and is
   * correct here: the storefront cart lives in the browser (`lib/cart-store`),
   * not in `carts`. Sharing a server cart the storefront does not use would
   * share an empty one.
   *
   * Nothing is trusted from that payload beyond *which variant* and *how
   * many*: no price is accepted or stored, because Invariant 11 resolves price
   * at open time. The worst a forged payload can do is produce a link to
   * products that exist.
   *
   * Variants are validated **at share time** so a typo or a stale browser
   * cannot mint a link to nothing. Availability is deliberately *not* checked
   * here — that is an open-time fact, and a piece that sells out between share
   * and open must show as unavailable rather than 404 the whole link.
   */
  async createShare(dto: CreateCartShareDto) {
    const variantIds = [...new Set(dto.items.map((item) => item.variantId))];
    const found = await this.prisma.productVariant.count({ where: { id: { in: variantIds } } });
    if (found !== variantIds.length) {
      throw new BadRequestException('One or more of these items no longer exists');
    }

    const share = await this.prisma.cartShare.create({
      data: {
        token: randomBytes(16).toString('hex'),
        items: {
          create: dto.items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
            giftWrap: item.giftWrap ?? false,
            giftNote: item.giftNote,
          })),
        },
      },
    });

    return { token: share.token };
  }

  /**
   * Opens a shared cart. Public — the token is the only credential.
   *
   * Returns the frozen lines with **live** price and availability, which is
   * Invariant 11's other half. An unavailable line is returned marked, not
   * dropped: the recipient should see that the sender meant to send it and
   * that they cannot have it, rather than silently receiving a shorter cart.
   *
   * Says nothing about who shared it — there is no owner column to leak
   * (Invariant 9).
   */
  async getShare(token: string) {
    const share = await this.prisma.cartShare.findUnique({
      where: { token },
      include: { items: { include: { variant: { include: { product: true } } } } },
    });
    if (!share) {
      throw new NotFoundException('This cart link is invalid or has expired');
    }

    return {
      items: share.items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
        giftWrap: item.giftWrap,
        giftNote: item.giftNote,
        productName: item.variant.product.name,
        productSlug: item.variant.product.slug,
        metal: item.variant.metal,
        size: item.variant.size,
        // Read now, not at share time.
        unitPriceMinorUnits: item.variant.basePriceMinorUnits,
        available:
          item.variant.product.status === ProductStatus.PUBLISHED && !item.variant.product.deletedAt,
      })),
    };
  }
}
