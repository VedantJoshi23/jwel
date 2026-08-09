import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdoptSharedCart } from './adopt-shared-cart';
import { useAuthStore } from '@/lib/auth-store';
import { addToWishlist } from '@/lib/api/wishlist';
import { addCartLine, clearCart, getCart } from '@/lib/api/cart';
import type { SharedCartLine } from '@/lib/api/cart-share';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/api/wishlist', () => ({ addToWishlist: vi.fn() }));
vi.mock('@/lib/api/cart', () => ({
  getCart: vi.fn(),
  addCartLine: vi.fn(),
  updateCartLine: vi.fn(),
  removeCartLine: vi.fn(),
  clearCart: vi.fn(),
  claimGuestCart: vi.fn(),
}));

const save = vi.mocked(addToWishlist);
const cart = vi.mocked(getCart);
const addLine = vi.mocked(addCartLine);
const emptyCart = vi.mocked(clearCart);

function sharedLine(over: Partial<SharedCartLine> = {}): SharedCartLine {
  return {
    variantId: 'shared-v1',
    quantity: 2,
    giftWrap: false,
    giftNote: null,
    productName: 'Shared Ring',
    productSlug: 'shared-ring',
    metal: 'GOLD',
    size: '16',
    unitPriceMinorUnits: 100000,
    available: true,
    ...over,
  };
}

const serverCart = (items: unknown[] = []) =>
  ({ id: 'c1', userId: null, guestToken: 'g', items }) as never;

const ownLine = (variantId = 'my-v1') => ({
  id: `line-${variantId}`,
  variantId,
  quantity: 1,
  priceSnapshotMinorUnits: 50000,
  giftWrap: false,
  giftNote: null,
  variant: {
    id: variantId,
    sku: 'S',
    metal: 'SILVER',
    size: null,
    basePriceMinorUnits: 50000,
    product: { id: 'p', name: 'My Ring', slug: 'my-ring' },
  },
});

function renderAdopt(lines: SharedCartLine[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AdoptSharedCart lines={lines} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

function signIn() {
  useAuthStore.getState().setSession('token-1', {
    id: 'u1',
    email: 'a@b.c',
    name: null,
    role: 'CUSTOMER',
  });
}

/**
 * DOM-SHOPPING Invariants 12 to 16.
 *
 * The bag lives on the server now, so this component's job narrowed: it still
 * decides *what to ask* and *what to send*, but the summing in Invariant 15
 * and the line identity in Invariant 1 are the API's, which is where they can
 * actually be enforced. These tests assert the asking and the sending.
 */
describe('AdoptSharedCart', () => {
  beforeEach(() => {
    push.mockClear();
    save.mockReset();
    save.mockResolvedValue({} as never);
    cart.mockReset();
    addLine.mockReset();
    emptyCart.mockReset();
    cart.mockResolvedValue(serverCart());
    addLine.mockResolvedValue(serverCart());
    emptyCart.mockResolvedValue(undefined as never);
  });
  afterEach(() => useAuthStore.getState().logout());

  describe('with an empty bag (Invariant 12)', () => {
    it('adopts with no prompt', async () => {
      const user = renderAdopt([sharedLine()]);

      expect(screen.queryByText(/You already have a bag/)).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Add these to my bag/ }));

      await waitFor(() =>
        expect(addLine).toHaveBeenCalledWith(null, {
          variantId: 'shared-v1',
          quantity: 2,
          giftWrap: false,
          giftNote: undefined,
        }),
      );
      expect(push).toHaveBeenCalledWith('/cart');
    });

    it('carries the gift options the sender chose', async () => {
      // Which gift options were shared is half of what Invariant 11 freezes,
      // so dropping them on adoption would lose the sender's intent.
      const user = renderAdopt([sharedLine({ giftWrap: true, giftNote: 'For Diya' })]);
      await user.click(screen.getByRole('button', { name: /Add these to my bag/ }));

      await waitFor(() =>
        expect(addLine).toHaveBeenCalledWith(
          null,
          expect.objectContaining({ giftWrap: true, giftNote: 'For Diya' }),
        ),
      );
    });
  });

  describe('with a bag of my own (Invariants 12–15)', () => {
    beforeEach(() => cart.mockResolvedValue(serverCart([ownLine()])));

    it('asks rather than deciding', async () => {
      renderAdopt([sharedLine()]);
      await waitFor(() => expect(screen.getByText(/You already have a bag/)).toBeInTheDocument());
      expect(screen.getByRole('button', { name: /Add to what I have/ })).toBeInTheDocument();
    });

    it('merge adds the shared lines and leaves mine alone', async () => {
      // The server sums a line with matching variant *and* configuration and
      // keeps differing ones separate (Invariants 15 and 1) — this only has to
      // send them.
      const user = renderAdopt([sharedLine()]);
      await waitFor(() => screen.getByRole('button', { name: /Add to what I have/ }));
      await user.click(screen.getByRole('button', { name: /Add to what I have/ }));

      await waitFor(() => expect(addLine).toHaveBeenCalled());
      expect(emptyCart).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    });

    it('replace saves my pieces to my wishlist first (Invariant 13)', async () => {
      signIn();
      const user = renderAdopt([sharedLine()]);
      await waitFor(() => screen.getByRole('button', { name: /Replace mine/ }));
      await user.click(screen.getByRole('button', { name: /Replace mine/ }));

      await waitFor(() => expect(save).toHaveBeenCalledWith('token-1', 'my-v1'));
      await waitFor(() => expect(emptyCart).toHaveBeenCalled());
      expect(addLine).toHaveBeenCalled();
    });

    it('replace still adopts when a wishlist write fails (Invariant 14)', async () => {
      signIn();
      save.mockRejectedValue(new Error('already there'));
      const user = renderAdopt([sharedLine()]);
      await waitFor(() => screen.getByRole('button', { name: /Replace mine/ }));
      await user.click(screen.getByRole('button', { name: /Replace mine/ }));

      await waitFor(() => expect(addLine).toHaveBeenCalled());
      expect(await screen.findByText(/could not be saved to your wishlist/)).toBeInTheDocument();
    });

    it('offers a guest sign-in instead of a replace that would lose their bag', async () => {
      // Invariant 13 — a wishlist needs a registered user, so replace is
      // blocked and explained rather than hidden.
      renderAdopt([sharedLine()]);
      await waitFor(() =>
        expect(screen.getByRole('link', { name: /Log in to replace/ })).toHaveAttribute(
          'href',
          '/login?next=/cart',
        ),
      );
      expect(screen.queryByRole('button', { name: /Replace mine/ })).not.toBeInTheDocument();
    });
  });

  describe('unavailable lines', () => {
    it('are never adopted', async () => {
      const user = renderAdopt([sharedLine(), sharedLine({ variantId: 'gone', available: false })]);
      await user.click(screen.getByRole('button', { name: /Add these to my bag/ }));

      await waitFor(() => expect(addLine).toHaveBeenCalledTimes(1));
      expect(addLine).toHaveBeenCalledWith(null, expect.objectContaining({ variantId: 'shared-v1' }));
    });

    it('say so when nothing can be adopted, rather than offering a dead button', () => {
      renderAdopt([sharedLine({ available: false })]);
      expect(screen.getByText(/None of these pieces are available/)).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});
