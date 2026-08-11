import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import WishlistPage from './page';
import { useAuthStore } from '@/lib/auth-store';
import { addCartLine } from '@/lib/api/cart';
import { getWishlist, removeFromWishlist } from '@/lib/api/wishlist';

vi.mock('@/lib/api/cart', () => ({
  getCart: vi.fn().mockResolvedValue({ id: 'c1', userId: null, guestToken: 'g', items: [] }),
  addCartLine: vi.fn().mockResolvedValue({ id: 'c1', items: [] }),
  updateCartLine: vi.fn(),
  removeCartLine: vi.fn(),
  clearCart: vi.fn(),
  claimGuestCart: vi.fn(),
}));
vi.mock('@/lib/api/wishlist', () => ({
  getWishlist: vi.fn(),
  removeFromWishlist: vi.fn(),
  addToWishlist: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const get = vi.mocked(getWishlist);
const remove = vi.mocked(removeFromWishlist);
const toastSuccess = vi.mocked(toast.success);

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
    product: { id: 'p1', name: 'Gold Ring', slug: 'gold-ring', status: 'PUBLISHED', deletedAt: null },
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
    vi.mocked(addCartLine).mockClear();
    toastSuccess.mockClear();
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
    await waitFor(() =>
      expect(addCartLine).toHaveBeenCalledWith(expect.anything(), { variantId: 'v1', quantity: 1 }),
    );
  });

  it('confirms the move with a toast — previously this click gave no feedback at all', async () => {
    const user = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Add to bag' }));
    expect(toastSuccess).toHaveBeenCalledWith('Added to bag', { description: 'Gold Ring' });
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

  describe('a saved piece that is no longer on sale', () => {
    const unavailable = (over: Record<string, unknown>) => ({
      ...item,
      variant: { ...item.variant, product: { ...item.variant.product, ...over } },
    });

    it('is kept and explained, not silently dropped', async () => {
      // The customer chose to save it. A list that quietly shrinks is worse
      // than one that says what happened.
      get.mockResolvedValue({
        id: 'w1',
        shareToken: 'tok-123',
        items: [unavailable({ status: 'ARCHIVED' })],
      } as never);

      renderPage();

      expect(await screen.findByText(/No longer available/)).toBeInTheDocument();
      // Still listed — the name appears in the row and again in the Remove
      // button's screen-reader label.
      expect(screen.getAllByText(/Gold Ring/).length).toBeGreaterThan(0);
    });

    it('cannot be added to the bag', async () => {
      get.mockResolvedValue({
        id: 'w1',
        shareToken: 'tok-123',
        items: [unavailable({ status: 'DRAFT' })],
      } as never);

      renderPage();
      await screen.findByText(/No longer available/);

      expect(screen.queryByRole('button', { name: 'Add to bag' })).not.toBeInTheDocument();
      // Removing it must still work — otherwise it is stuck there forever.
      expect(screen.getByRole('button', { name: /Remove/ })).toBeInTheDocument();
    });

    it('does not link to a product page that would 404', async () => {
      get.mockResolvedValue({
        id: 'w1',
        shareToken: 'tok-123',
        items: [unavailable({ deletedAt: '2026-08-01T00:00:00Z' })],
      } as never);

      renderPage();
      await screen.findByText(/No longer available/);

      expect(screen.queryByRole('link', { name: 'Gold Ring' })).not.toBeInTheDocument();
    });

    it('leaves an available piece alone', async () => {
      renderPage();
      expect(await screen.findByRole('link', { name: 'Gold Ring' })).toBeInTheDocument();
      expect(screen.queryByText(/No longer available/)).not.toBeInTheDocument();
    });
  });

  it('says nothing is saved rather than showing an empty share box', async () => {
    get.mockResolvedValue({ id: 'w1', shareToken: 'tok-123', items: [] } as never);
    renderPage();
    expect(await screen.findByText(/Nothing saved yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument();
  });
});
