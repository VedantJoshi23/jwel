import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CartDrawer } from './cart-drawer';
import { useCartDrawer } from '@/lib/cart-drawer-store';
import { getCart, removeCartLine, updateCartLine } from '@/lib/api/cart';
import type { ServerCart } from '@/lib/api/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock('@/lib/api/cart', () => ({
  getCart: vi.fn(),
  addCartLine: vi.fn(),
  updateCartLine: vi.fn(),
  removeCartLine: vi.fn(),
  clearCart: vi.fn(),
}));

function serverCart(quantity = 2): ServerCart {
  return {
    id: 'cart-1',
    userId: null,
    guestToken: 'g',
    items: [
      {
        id: 'line-1',
        variantId: 'v1',
        quantity,
        priceSnapshotMinorUnits: 210000,
        giftWrap: false,
        giftNote: null,
        variant: {
          id: 'v1',
          metal: 'SILVER',
          purity: '925',
          size: '10',
          basePriceMinorUnits: 210000,
          product: { id: 'p1', name: 'Iris Ring', slug: 'iris-ring', media: [] },
        },
      },
    ],
  } as unknown as ServerCart;
}

function renderDrawer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CartDrawer />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe('CartDrawer', () => {
  beforeEach(() => {
    vi.mocked(getCart).mockResolvedValue(serverCart());
    useCartDrawer.setState({ isOpen: false });
  });
  afterEach(() => {
    vi.clearAllMocks();
    useCartDrawer.setState({ isOpen: false });
  });

  it('stays out of the page until something opens it', () => {
    renderDrawer();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the bag, its subtotal, and both ways onward once opened', async () => {
    renderDrawer();
    useCartDrawer.getState().open();

    const dialog = await screen.findByRole('dialog');
    expect(await screen.findByText('Iris Ring')).toBeInTheDocument();
    // 2 × ₹2,100 — the running total is the thing a toast could never show.
    // Scoped to the subtotal row: with a single line its own total is the
    // same number, so an unscoped query matches both.
    const subtotalRow = within(dialog).getByText('Subtotal').parentElement!;
    expect(within(subtotalRow).getByText('₹4,200')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Checkout' })).toHaveAttribute('href', '/checkout');
    expect(screen.getByRole('link', { name: 'View bag' })).toHaveAttribute('href', '/cart');
  });

  it('counts pieces rather than lines in its title', async () => {
    renderDrawer();
    useCartDrawer.getState().open();
    // One line, quantity two.
    expect(await screen.findByText('Your bag · 2 pieces')).toBeInTheDocument();
  });

  it('closes on Escape, which is the "keep shopping" answer', async () => {
    const user = renderDrawer();
    useCartDrawer.getState().open();
    await screen.findByText('Iris Ring');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(useCartDrawer.getState().isOpen).toBe(false);
  });

  it('lets a line be removed without leaving the drawer', async () => {
    const user = renderDrawer();
    useCartDrawer.getState().open();
    await screen.findByRole('dialog');

    await screen.findByText('Iris Ring');
    await user.click(screen.getByRole('button', { name: 'Remove Iris Ring from your bag' }));

    expect(removeCartLine).toHaveBeenCalledWith(null, 'line-1');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('changes a quantity in place', async () => {
    const user = renderDrawer();
    useCartDrawer.getState().open();
    await screen.findByRole('dialog');

    await screen.findByText('Iris Ring');
    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));

    await waitFor(() => expect(updateCartLine).toHaveBeenCalled());
  });

  it('says so when the bag is emptied, rather than showing a ₹0 checkout', async () => {
    vi.mocked(getCart).mockResolvedValue({
      id: 'cart-1',
      userId: null,
      guestToken: 'g',
      items: [],
    } as unknown as ServerCart);
    renderDrawer();
    useCartDrawer.getState().open();

    expect(await screen.findByText('Your bag is empty.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Checkout' })).toBeNull();
  });
});
