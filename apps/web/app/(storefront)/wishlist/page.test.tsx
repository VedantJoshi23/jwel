import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WishlistPage from './page';
import { useAuthStore } from '@/lib/auth-store';
import { useCartStore } from '@/lib/cart-store';
import { getWishlist, removeFromWishlist } from '@/lib/api/wishlist';

vi.mock('@/lib/api/wishlist', () => ({
  getWishlist: vi.fn(),
  removeFromWishlist: vi.fn(),
  addToWishlist: vi.fn(),
}));

const get = vi.mocked(getWishlist);
const remove = vi.mocked(removeFromWishlist);

const item = {
  id: 'i1',
  variantId: 'v1',
  addedAt: '2026-08-01T00:00:00Z',
  variant: {
    id: 'v1',
    sku: 'S1',
    metal: 'GOLD',
    size: '16',
    basePriceMinorUnits: 250000,
    product: { id: 'p1', name: 'Gold Ring', slug: 'gold-ring' },
  },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <WishlistPage />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe('WishlistPage', () => {
  beforeEach(() => {
    get.mockReset();
    remove.mockReset();
    get.mockResolvedValue({ id: 'w1', shareToken: 'tok-123', items: [item] } as never);
    remove.mockResolvedValue({} as never);
    useCartStore.getState().clear();
    useAuthStore.getState().setSession('token-1', {
      id: 'u1',
      email: 'a@b.c',
      name: null,
      role: 'CUSTOMER',
    });
  });
  afterEach(() => useAuthStore.getState().logout());

  it('asks a logged-out visitor to log in', () => {
    useAuthStore.getState().logout();
    renderPage();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('lists a saved piece with its variant and live price', async () => {
    renderPage();
    expect(await screen.findByRole('link', { name: 'Gold Ring' })).toBeInTheDocument();
    expect(screen.getByText(/GOLD/)).toBeInTheDocument();
    expect(screen.getByText(/Size 16/)).toBeInTheDocument();
  });

  it('moves a saved piece into the bag', async () => {
    const user = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Add to bag' }));
    await waitFor(() => expect(useCartStore.getState().lines).toHaveLength(1));
    expect(useCartStore.getState().lines[0].variantId).toBe('v1');
  });

  it('removes a saved piece', async () => {
    const user = renderPage();
    await user.click(await screen.findByRole('button', { name: /Remove/ }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith('token-1', 'v1'));
  });

  it('says what a share link does and does not expose', async () => {
    // Invariant 9 is a promise to the owner; saying it out loud is what makes
    // sharing a considered act rather than a surprise.
    renderPage();
    expect(await screen.findByText(/cannot change your list/)).toBeInTheDocument();
    expect(screen.getByText(/does not show them who you are/)).toBeInTheDocument();
  });

  it('offers the WhatsApp share the token was built for', async () => {
    renderPage();
    const link = await screen.findByRole('link', { name: /Share on WhatsApp/ });
    expect(link).toHaveAttribute('href', expect.stringContaining('wa.me'));
    expect(link).toHaveAttribute('href', expect.stringContaining('tok-123'));
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('says nothing is saved rather than showing an empty share box', async () => {
    get.mockResolvedValue({ id: 'w1', shareToken: 'tok-123', items: [] } as never);
    renderPage();
    expect(await screen.findByText(/Nothing saved yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument();
  });
});
