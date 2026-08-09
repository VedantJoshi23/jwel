import { CartService } from './cart.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Claiming a guest cart — `DOM-SHOPPING` Invariants 6, 12-15 and 17.
 *
 * Invariant 17's direction is the thing most easily got backwards: both carts
 * belong to the same person, so **replace keeps the cart they are currently
 * holding** — the guest one — and the older account cart goes to the wishlist.
 * The reverse would discard what they assembled seconds ago.
 */
describe('CartService — claiming a guest cart', () => {
  let prisma: any;
  let service: CartService;

  const line = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    cartId: 'guest-cart',
    variantId: `v-${id}`,
    quantity: 1,
    giftWrap: false,
    giftNote: null,
    ...over,
  });

  beforeEach(() => {
    prisma = {
      cart: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'account-cart', items: [] }),
        delete: jest.fn().mockResolvedValue({}),
      },
      cartItem: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      wishlist: {
        findUnique: jest.fn().mockResolvedValue({ id: 'wl-1' }),
        create: jest.fn().mockResolvedValue({ id: 'wl-1' }),
      },
      wishlistItem: { upsert: jest.fn().mockResolvedValue({}) },
    };
    service = new CartService(prisma as unknown as PrismaService);
  });

  /** guest cart, then account cart, then the reload after the move */
  function carts(guestItems: unknown[], accountItems: unknown[]) {
    prisma.cart.findUnique
      .mockResolvedValueOnce(guestItems.length || true ? { id: 'guest-cart', items: guestItems } : null)
      .mockResolvedValueOnce({ id: 'account-cart', items: accountItems })
      .mockResolvedValue({ id: 'account-cart', items: accountItems });
  }

  it('does nothing when the guest never had a cart', async () => {
    prisma.cart.findUnique.mockResolvedValueOnce(null).mockResolvedValue({ id: 'account-cart', items: [] });

    const result = await service.claimGuestCart('u1', 'guest-token');

    expect(result.outcome).toBe('nothing_to_claim');
    expect(prisma.cartItem.update).not.toHaveBeenCalled();
  });

  it('adopts silently into an empty account cart (Invariant 12)', async () => {
    carts([line('a')], []);
    prisma.cartItem.findMany.mockResolvedValueOnce([line('a')]).mockResolvedValueOnce([]);

    const result = await service.claimGuestCart('u1', 'guest-token');

    expect(result.outcome).toBe('adopted');
    // Re-parented, not copied — the price snapshot the line was created with
    // survives (Invariant 3).
    expect(prisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { cartId: 'account-cart' },
    });
    expect(prisma.cart.delete).toHaveBeenCalledWith({ where: { id: 'guest-cart' } });
  });

  it('asks rather than deciding when both carts have items (Invariant 12)', async () => {
    carts([line('a')], [line('b')]);

    const result = await service.claimGuestCart('u1', 'guest-token');

    expect(result.outcome).toBe('conflict');
    // Nothing moved, nothing deleted, nothing saved. The prompt is the
    // client's and the choice is the customer's.
    expect(prisma.cartItem.update).not.toHaveBeenCalled();
    expect(prisma.cartItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.wishlistItem.upsert).not.toHaveBeenCalled();
    expect(result.guestCart).toBeDefined();
  });

  describe('merge (Invariant 15)', () => {
    it('sums quantities for lines with matching configuration', async () => {
      carts([line('a', { quantity: 2 })], [line('b', { variantId: 'v-a' })]);
      prisma.cartItem.findMany
        .mockResolvedValueOnce([line('a', { quantity: 2, variantId: 'v-a' })])
        .mockResolvedValueOnce([line('b', { variantId: 'v-a', quantity: 1 })]);

      const result = await service.claimGuestCart('u1', 'guest-token', 'merge');

      expect(result.outcome).toBe('merged');
      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'b' },
        data: { quantity: 3 },
      });
      expect(prisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: 'a' } });
    });

    it('keeps differing configurations as separate lines (Invariant 1)', async () => {
      // Same ring, one gift-wrapped and one not.
      carts([line('a', { variantId: 'v-x', giftWrap: true })], [line('b', { variantId: 'v-x' })]);
      prisma.cartItem.findMany
        .mockResolvedValueOnce([line('a', { variantId: 'v-x', giftWrap: true })])
        .mockResolvedValueOnce([line('b', { variantId: 'v-x', giftWrap: false })]);

      await service.claimGuestCart('u1', 'guest-token', 'merge');

      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'a' },
        data: { cartId: 'account-cart' },
      });
      expect(prisma.cartItem.delete).not.toHaveBeenCalled();
    });

    it('never touches the wishlist', async () => {
      carts([line('a')], [line('b')]);
      prisma.cartItem.findMany.mockResolvedValueOnce([line('a')]).mockResolvedValueOnce([line('b')]);

      await service.claimGuestCart('u1', 'guest-token', 'merge');

      expect(prisma.wishlistItem.upsert).not.toHaveBeenCalled();
    });
  });

  describe('replace (Invariants 13, 14 and 17)', () => {
    it('saves the ACCOUNT cart to the wishlist and keeps the guest cart', async () => {
      // The direction that is easy to get backwards: the guest cart is what
      // the customer is holding right now.
      carts([line('guest-line')], [line('account-line', { variantId: 'v-old' })]);
      prisma.cartItem.findMany.mockResolvedValueOnce([line('guest-line')]).mockResolvedValueOnce([]);

      const result = await service.claimGuestCart('u1', 'guest-token', 'replace');

      expect(result.outcome).toBe('replaced');
      expect(prisma.wishlistItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: { wishlistId: 'wl-1', variantId: 'v-old' },
        }),
      );
      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: 'account-cart' } });
    });

    it('upserts rather than inserting, so an already-saved item does not error (Invariant 14)', async () => {
      carts([line('guest-line')], [line('account-line', { variantId: 'v-old' })]);
      prisma.cartItem.findMany.mockResolvedValueOnce([line('guest-line')]).mockResolvedValueOnce([]);

      await service.claimGuestCart('u1', 'guest-token', 'replace');

      expect(prisma.wishlistItem.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {} }));
    });

    it('still completes when a wishlist save fails', async () => {
      // Otherwise the customer is stranded between two carts.
      carts([line('guest-line')], [line('account-line', { variantId: 'v-old' })]);
      prisma.cartItem.findMany.mockResolvedValueOnce([line('guest-line')]).mockResolvedValueOnce([]);
      prisma.wishlistItem.upsert.mockRejectedValue(new Error('nope'));

      const result = await service.claimGuestCart('u1', 'guest-token', 'replace');

      expect(result.outcome).toBe('replaced');
      expect(prisma.cartItem.deleteMany).toHaveBeenCalled();
    });

    it('creates a wishlist for a customer who has never saved anything', async () => {
      prisma.wishlist.findUnique.mockResolvedValue(null);
      carts([line('guest-line')], [line('account-line', { variantId: 'v-old' })]);
      prisma.cartItem.findMany.mockResolvedValueOnce([line('guest-line')]).mockResolvedValueOnce([]);

      await service.claimGuestCart('u1', 'guest-token', 'replace');

      expect(prisma.wishlist.create).toHaveBeenCalled();
    });
  });
});
