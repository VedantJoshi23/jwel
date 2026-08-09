import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdoptSharedCart } from './adopt-shared-cart';
import { useAuthStore } from '@/lib/auth-store';
import { useCartStore } from '@/lib/cart-store';
import { addToWishlist } from '@/lib/api/wishlist';
import type { SharedCartLine } from '@/lib/api/cart-share';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/api/wishlist', () => ({ addToWishlist: vi.fn() }));

const save = vi.mocked(addToWishlist);

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

function ownLine(variantId = 'my-v1') {
  return {
    variantId,
    productSlug: 'my-ring',
    productName: 'My Ring',
    metal: 'SILVER',
    size: null,
    unitPriceMinorUnits: 50000,
    quantity: 1,
  };
}

function signIn() {
  useAuthStore.getState().setSession('token-1', {
    id: 'u1',
    email: 'a@b.c',
    name: null,
    role: 'CUSTOMER',
  });
}

/** DOM-SHOPPING Invariants 12 to 16. */
describe('AdoptSharedCart', () => {
  beforeEach(() => {
    push.mockClear();
    save.mockReset();
    save.mockResolvedValue({} as never);
    useCartStore.getState().clear();
  });
  afterEach(() => useAuthStore.getState().logout());

  describe('with an empty bag (Invariant 12)', () => {
    it('adopts with no prompt', async () => {
      const user = userEvent.setup();
      render(<AdoptSharedCart lines={[sharedLine()]} />);

      expect(screen.queryByText(/You already have a bag/)).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Add these to my bag/ }));

      await waitFor(() => expect(useCartStore.getState().lines).toHaveLength(1));
      expect(push).toHaveBeenCalledWith('/cart');
    });
  });

  describe('with a bag of my own (Invariants 12–15)', () => {
    beforeEach(() => useCartStore.getState().addLine(ownLine()));

    it('asks rather than deciding', () => {
      render(<AdoptSharedCart lines={[sharedLine()]} />);
      expect(screen.getByText(/You already have a bag/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add to what I have/ })).toBeInTheDocument();
    });

    it('merge keeps both carts', async () => {
      const user = userEvent.setup();
      render(<AdoptSharedCart lines={[sharedLine()]} />);

      await user.click(screen.getByRole('button', { name: /Add to what I have/ }));

      await waitFor(() => expect(useCartStore.getState().lines).toHaveLength(2));
    });

    it('merge sums quantities for a line I already hold (Invariant 15)', async () => {
      useCartStore.getState().clear();
      useCartStore.getState().addLine({ ...ownLine('shared-v1'), quantity: 1 });

      const user = userEvent.setup();
      render(<AdoptSharedCart lines={[sharedLine({ quantity: 2 })]} />);
      await user.click(screen.getByRole('button', { name: /Add to what I have/ }));

      await waitFor(() => expect(useCartStore.getState().lines).toHaveLength(1));
      expect(useCartStore.getState().lines[0].quantity).toBe(3);
    });

    it('replace saves my pieces to my wishlist first (Invariant 13)', async () => {
      signIn();
      const user = userEvent.setup();
      render(<AdoptSharedCart lines={[sharedLine()]} />);

      await user.click(screen.getByRole('button', { name: /Replace mine/ }));

      await waitFor(() => expect(save).toHaveBeenCalledWith('token-1', 'my-v1'));
      await waitFor(() => expect(useCartStore.getState().lines).toHaveLength(1));
      expect(useCartStore.getState().lines[0].variantId).toBe('shared-v1');
    });

    it('replace still adopts when a wishlist write fails (Invariant 14)', async () => {
      // Upsert-and-ignore. A failure there must not strand the recipient
      // between two carts.
      signIn();
      save.mockRejectedValue(new Error('already there'));
      const user = userEvent.setup();
      render(<AdoptSharedCart lines={[sharedLine()]} />);

      await user.click(screen.getByRole('button', { name: /Replace mine/ }));

      await waitFor(() => expect(useCartStore.getState().lines).toHaveLength(1));
      expect(useCartStore.getState().lines[0].variantId).toBe('shared-v1');
      expect(await screen.findByText(/could not be saved to your wishlist/)).toBeInTheDocument();
    });

    it('offers a guest sign-in instead of a replace that would lose their bag', () => {
      // Invariant 13 — a wishlist needs a registered user, so replace is
      // blocked and explained rather than hidden.
      render(<AdoptSharedCart lines={[sharedLine()]} />);
      expect(screen.getByRole('link', { name: /Log in to replace/ })).toHaveAttribute(
        'href',
        '/login?next=/cart',
      );
      expect(screen.queryByRole('button', { name: /Replace mine/ })).not.toBeInTheDocument();
    });
  });

  describe('unavailable lines', () => {
    it('are never adopted', async () => {
      const user = userEvent.setup();
      render(<AdoptSharedCart lines={[sharedLine(), sharedLine({ variantId: 'gone', available: false })]} />);

      await user.click(screen.getByRole('button', { name: /Add these to my bag/ }));

      await waitFor(() => expect(useCartStore.getState().lines).toHaveLength(1));
      expect(useCartStore.getState().lines[0].variantId).toBe('shared-v1');
    });

    it('say so when nothing can be adopted, rather than offering a dead button', () => {
      render(<AdoptSharedCart lines={[sharedLine({ available: false })]} />);
      expect(screen.getByText(/None of these pieces are available/)).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});
