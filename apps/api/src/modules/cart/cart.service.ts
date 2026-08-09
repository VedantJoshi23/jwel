import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CreateCartShareDto } from './dto/create-cart-share.dto';
import { STORAGE_PROVIDER, StorageProviderPort } from '../storage/ports/storage-provider.port';

const cartInclude = {
  items: {
    include: {
      variant: {
        include: {
          // The product's own photograph, so the bag can show the piece the
          // customer actually chose. Without this the storefront had nothing
          // to render and fell back to a stock image of a different ring —
          // the PDP showed one thing and the cart another.
          //
          // First image only, by sort order: a cart row is a thumbnail, and
          // pulling a whole gallery per line to use one of them is waste.
          product: { include: { media: { orderBy: { sortOrder: 'asc' }, take: 1 } } },
        },
      },
    },
  },
} as const;

/**
 * Who a cart belongs to — `DOM-SHOPPING` Invariant 5: **either** a registered
 * user **or** a guest session, never neither. Both columns are unique-nullable
 * in the schema, and this type is the application's half of that XOR.
 */
/** A cart line with its product's first image, as `cartInclude` fetches it. */
type CartLineWithMedia = {
  variant: { product: { media: { storageRef: string }[] } };
};

export type CartIdentity = { userId: string; guestToken?: never } | { guestToken: string; userId?: never };

/**
 * Two cart lines are the same line when they are the same variant **with the
 * same configuration** — `DOM-SHOPPING` Invariant 1. Adding a ring that is
 * already in the bag unwrapped, this time gift-wrapped with a note, is a
 * second line rather than a quantity bump.
 *
 * This is what replaced `@@unique([cartId, variantId])`, which made the two
 * indistinguishable and so contradicted Invariants 4 and 15.
 */
function isSameLine(
  line: { variantId: string; giftWrap: boolean; giftNote: string | null },
  candidate: { variantId: string; giftWrap?: boolean; giftNote?: string | null },
): boolean {
  return (
    line.variantId === candidate.variantId &&
    line.giftWrap === (candidate.giftWrap ?? false) &&
    (line.giftNote ?? null) === (candidate.giftNote ?? null)
  );
}

/**
 * Persisted server-side cart — closes the gap named in BACKEND.md §4 ("no
 * Cart module ... no cross-device cart persistence"). This is additive, not
 * a breaking change: `OrdersService.create` still accepts a flat `items[]`
 * array directly (FRONTEND.md's local cart already submits that shape), so
 * existing checkout integration is untouched. A client can now *optionally*
 * sync its cart here for cross-device persistence before checkout.
 */
/** What `claimGuestCart` did, so the client knows whether to prompt. */
export interface CartClaimResult {
  outcome: 'nothing_to_claim' | 'adopted' | 'merged' | 'replaced' | 'conflict';
  /** The account's cart as it now stands. */
  cart: unknown;
  /** Present only on `conflict` — what the guest cart holds, so the prompt can describe it. */
  guestCart?: unknown;
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProviderPort,
  ) {}

  /**
   * Turns each line's stored `storageRef` into a URL the browser can load.
   *
   * Resolved here rather than in the client for the reason
   * `StorageProviderPort` gives: only the server knows which provider is
   * configured and how its refs map to URLs. A `local:products/x.png` means
   * nothing to a browser.
   */
  private withResolvedMedia<T extends { items: CartLineWithMedia[] }>(cart: T): T {
    return {
      ...cart,
      items: cart.items.map((item) => ({
        ...item,
        variant: {
          ...item.variant,
          product: {
            ...item.variant.product,
            media: item.variant.product.media.map((m) => ({
              ...m,
              url: this.storage.resolveUrl(m.storageRef),
            })),
          },
        },
      })),
    };
  }

  /**
   * Finds or creates the cart for this identity. Invariant 5's XOR is enforced
   * here because Prisma cannot express it — exactly one of the two columns is
   * ever written.
   */
  private async getOrCreateCart(identity: CartIdentity) {
    const where = identity.userId ? { userId: identity.userId } : { guestToken: identity.guestToken };
    const existing = await this.prisma.cart.findUnique({ where: where as never, include: cartInclude });
    if (existing) return existing;
    return this.prisma.cart.create({ data: where as never, include: cartInclude });
  }

  async getCart(identity: CartIdentity) {
    return this.withResolvedMedia(await this.getOrCreateCart(identity));
  }

  async addItem(identity: CartIdentity, dto: AddCartItemDto) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      include: { product: true },
    });
    if (!variant || variant.product.status !== ProductStatus.PUBLISHED || variant.product.deletedAt) {
      throw new BadRequestException('This item is not available for purchase');
    }

    const cart = await this.getOrCreateCart(identity);
    // Matched on variant **and** configuration (Invariant 1). Matching on
    // variant alone is what the dropped unique constraint forced, and it made
    // per-line gift wrap impossible to express.
    const existingItem = cart.items.find((item) => isSameLine(item, dto));

    if (existingItem) {
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + dto.quantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId: dto.variantId,
          quantity: dto.quantity,
          // Invariant 3 — the price as it was when the line was created.
          priceSnapshotMinorUnits: variant.basePriceMinorUnits,
          giftWrap: dto.giftWrap ?? false,
          giftNote: dto.giftNote,
        },
      });
    }

    return this.getCart(identity);
  }

  /**
   * Addressed by **line id**, not variant id.
   *
   * Once a variant can appear more than once in a cart, "the line for variant
   * X" stops identifying anything — a `PATCH /cart/items/:variantId` would have
   * to guess which of the two the shopper meant.
   *
   * The line is looked up within this identity's own cart, so a line id
   * belonging to somebody else's cart is a 404 rather than an edit.
   */
  async updateItemQuantity(identity: CartIdentity, lineId: string, quantity: number) {
    const cart = await this.getOrCreateCart(identity);
    const item = cart.items.find((i) => i.id === lineId);
    if (!item) {
      throw new NotFoundException('This item is not in your cart');
    }
    // Invariant 2 — reducing to zero removes the line rather than storing a
    // quantity the CHECK constraint would reject anyway.
    if (quantity <= 0) {
      await this.prisma.cartItem.delete({ where: { id: item.id } });
    } else {
      await this.prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
    }
    return this.getCart(identity);
  }

  async removeItem(identity: CartIdentity, lineId: string) {
    const cart = await this.getOrCreateCart(identity);
    const item = cart.items.find((i) => i.id === lineId);
    if (!item) {
      throw new NotFoundException('This item is not in your cart');
    }
    await this.prisma.cartItem.delete({ where: { id: item.id } });
    return this.getCart(identity);
  }

  async clear(identity: CartIdentity): Promise<void> {
    const cart = await this.getOrCreateCart(identity);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }

  // ────────────────────────────────────────────────────────────────────────
  // CLAIMING A GUEST CART — DOM-SHOPPING Invariants 6, 12-15 and 17
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Hands a guest cart to the account that just signed in or registered.
   *
   * Invariant 6 says a guest cart is **claimed**, its lines transferring rather
   * than being discarded. Invariant 17 says what happens when the account
   * already has a cart of its own: the customer is asked, with the same
   * mechanics as opening a shared cart — and **replace keeps the cart they are
   * currently holding**, the guest one, moving the older account cart to the
   * wishlist.
   *
   * The direction matters and is easy to get backwards. Both carts belong to
   * the same person, so "replace" is ambiguous in a way it was not for a shared
   * cart; the reverse would discard what they assembled seconds ago.
   *
   * **This method never decides for them.** With no strategy and two non-empty
   * carts it reports `conflict` and changes nothing, because Invariant 12
   * forbids silently discarding either side. The prompt is the client's to
   * show; the choice is the customer's to make.
   */
  async claimGuestCart(
    userId: string,
    guestToken: string,
    strategy?: 'merge' | 'replace',
  ): Promise<CartClaimResult> {
    const guestCart = await this.prisma.cart.findUnique({
      where: { guestToken },
      include: cartInclude,
    });

    if (!guestCart || guestCart.items.length === 0) {
      // Nothing to hand over. An account cart, if any, is untouched.
      if (guestCart) await this.prisma.cart.delete({ where: { id: guestCart.id } });
      return { outcome: 'nothing_to_claim', cart: await this.getCart({ userId }) };
    }

    const accountCart = await this.getOrCreateCart({ userId });

    // Invariant 12 — an empty cart adopts with no prompt.
    if (accountCart.items.length === 0) {
      await this.moveLines(guestCart.id, accountCart.id);
      await this.prisma.cart.delete({ where: { id: guestCart.id } });
      return { outcome: 'adopted', cart: await this.getCart({ userId }) };
    }

    if (!strategy) {
      return {
        outcome: 'conflict',
        cart: accountCart,
        guestCart,
      };
    }

    if (strategy === 'replace') {
      // Invariant 13/17 — the account's older lines go to the wishlist, not to
      // nothing, and then the guest cart wins.
      await this.saveLinesToWishlist(userId, accountCart.items);
      await this.prisma.cartItem.deleteMany({ where: { cartId: accountCart.id } });
    }

    // Merge and replace both end the same way: the guest lines move in.
    // Invariant 15's summing is `moveLines`, which matches on configuration.
    await this.moveLines(guestCart.id, accountCart.id);
    await this.prisma.cart.delete({ where: { id: guestCart.id } });

    return { outcome: strategy === 'merge' ? 'merged' : 'replaced', cart: await this.getCart({ userId }) };
  }

  /**
   * Moves every line of one cart into another, summing quantities where the
   * **variant and configuration** match and keeping them separate where they
   * do not — Invariant 15, which is Invariant 1 applied to a merge.
   */
  private async moveLines(fromCartId: string, toCartId: string): Promise<void> {
    const [from, to] = await Promise.all([
      this.prisma.cartItem.findMany({ where: { cartId: fromCartId } }),
      this.prisma.cartItem.findMany({ where: { cartId: toCartId } }),
    ]);

    for (const line of from) {
      const match = to.find((existing) => isSameLine(existing, line));
      if (match) {
        await this.prisma.cartItem.update({
          where: { id: match.id },
          data: { quantity: match.quantity + line.quantity },
        });
        await this.prisma.cartItem.delete({ where: { id: line.id } });
      } else {
        // Re-parented rather than copied, so the price snapshot the line was
        // created with survives (Invariant 3). Copying would silently reprice
        // it at merge time.
        await this.prisma.cartItem.update({
          where: { id: line.id },
          data: { cartId: toCartId },
        });
      }
    }
  }

  /**
   * Invariant 13 — replaced lines are saved, not dropped.
   *
   * **Upsert-and-ignore** (Invariant 14): an item already wishlisted is not
   * duplicated and does not error. A failure to save one line must not abort
   * the claim and strand the customer between two carts.
   *
   * What is lost is quantity, gift wrap and the note: `WishlistItem` carries
   * none of them, so three gift-wrapped rings come back as one wishlist entry
   * (`DOM-SHOPPING` §"Two consequences"). The UI must say "moved to your
   * wishlist", never "we saved your cart".
   */
  private async saveLinesToWishlist(
    userId: string,
    lines: { variantId: string }[],
  ): Promise<void> {
    const wishlist =
      (await this.prisma.wishlist.findUnique({ where: { userId } })) ??
      (await this.prisma.wishlist.create({
        data: { userId, shareToken: randomBytes(16).toString('hex') },
      }));

    for (const line of lines) {
      try {
        await this.prisma.wishlistItem.upsert({
          where: { wishlistId_variantId: { wishlistId: wishlist.id, variantId: line.variantId } },
          create: { wishlistId: wishlist.id, variantId: line.variantId },
          update: {},
        });
      } catch (error) {
        this.logger.warn(
          `Could not save variant ${line.variantId} to the wishlist during a cart claim: ${
            (error as Error).message
          }`,
        );
      }
    }
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
