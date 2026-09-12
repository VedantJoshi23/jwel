import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductCard } from './product-card';
import { useAuthStore } from '@/lib/auth-store';
import { addCartLine } from '@/lib/api/cart';
import { addToWishlist, getWishlist, removeFromWishlist } from '@/lib/api/wishlist';
import type { Product } from '@/lib/api/types';

// The card now renders WishlistHeartButton and CardQuickAdd, both of which
// talk to the server through react-query — a bare `render()` throws "No
// QueryClient set" without this.
vi.mock('@/lib/api/cart', () => ({
  addCartLine: vi.fn(),
  getCart: vi.fn().mockResolvedValue({ id: 'c1', userId: null, guestToken: 'g', items: [] }),
}));
// `useAddedToBagToast` (reached via the add-to-bag path) calls `useRouter`
// to offer "View bag", and the app router is not mounted under jsdom.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock('@/lib/api/wishlist', () => ({
  getWishlist: vi.fn(),
  addToWishlist: vi.fn(),
  removeFromWishlist: vi.fn(),
}));

const addCartLineMock = vi.mocked(addCartLine);
const getWishlistMock = vi.mocked(getWishlist);
const addToWishlistMock = vi.mocked(addToWishlist);
const removeFromWishlistMock = vi.mocked(removeFromWishlist);

function fakeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Gold Ring',
    slug: 'gold-ring',
    description: 'd',
    status: 'PUBLISHED',
    certificationType: null,
    avgRating: '0',
    ratingCount: 0,
    category: { id: 'c1', name: 'Rings', slug: 'rings', parentId: null },
    variants: [{ id: 'v1', sku: 'S1', metal: 'GOLD', purity: '18K', size: null, weightGrams: '2', basePriceMinorUnits: 250000 }],
    media: [],
    ...overrides,
  };
}

async function renderCard(product: Product, isNew?: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={client}>
      <ProductCard product={product} isNew={isNew} />
    </QueryClientProvider>,
  );
  // Every card mounts both WishlistHeartButton (a `getWishlist` query,
  // fetched only when signed in) and CardQuickAdd (a `getCart` query, via
  // `useCart`, always fetched). Both are mocked to resolve immediately;
  // flushing that resolution here, once, inside act() is what keeps every
  // later assertion inside an act() boundary — a test about one control has
  // no reason to know the other control's query needs awaiting too.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return result;
}

describe('ProductCard', () => {
  beforeEach(() => {
    getWishlistMock.mockReset().mockResolvedValue({ id: 'w1', shareToken: 'tok', items: [] });
    addToWishlistMock.mockReset().mockResolvedValue({} as never);
    removeFromWishlistMock.mockReset().mockResolvedValue({} as never);
    addCartLineMock.mockReset().mockResolvedValue({ id: 'c1', userId: null, guestToken: 'g', items: [] } as never);
    useAuthStore.getState().logout();
  });
  afterEach(() => useAuthStore.getState().logout());

  it('links to the product detail page', async () => {
    // Two links now (image + body) — a button cannot nest inside an anchor,
    // so the overlay controls sit beside the image link rather than inside a
    // single card-wide one. Both must point at the same product, and there
    // must not be a third: the wishlist/login link below is a different
    // destination and is checked separately.
    await renderCard(fakeProduct());
    const productLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/product/gold-ring');
    expect(productLinks).toHaveLength(2);
  });

  it('shows the product name and lowest variant price', async () => {
    await renderCard(fakeProduct());
    expect(screen.getByText('Gold Ring')).toBeInTheDocument();
    expect(screen.getByText('₹2,500')).toBeInTheDocument();
  });

  it('shows the lowest price across multiple variants', async () => {
    await renderCard(
      fakeProduct({
        variants: [
          { id: 'v1', sku: 'S1', metal: 'GOLD', purity: '18K', size: null, weightGrams: '2', basePriceMinorUnits: 250000 },
          { id: 'v2', sku: 'S2', metal: 'GOLD', purity: '18K', size: null, weightGrams: '3', basePriceMinorUnits: 150000 },
        ],
      }),
    );
    expect(screen.getByText('₹1,500')).toBeInTheDocument();
  });

  it('omits the rating stars when avgRating is 0', async () => {
    await renderCard(fakeProduct({ avgRating: '0' }));
    expect(screen.queryByRole('img', { name: /out of 5 stars/i })).not.toBeInTheDocument();
  });

  it('shows rating stars when avgRating is positive', async () => {
    await renderCard(fakeProduct({ avgRating: '4.5', ratingCount: 10 }));
    expect(screen.getByRole('img', { name: /out of 5 stars/i })).toBeInTheDocument();
  });

  it('shows the NEW ARRIVAL badge when isNew is true', async () => {
    await renderCard(fakeProduct(), true);
    expect(screen.getByLabelText('New arrival')).toBeInTheDocument();
  });

  it('omits the NEW ARRIVAL badge by default', async () => {
    await renderCard(fakeProduct());
    expect(screen.queryByLabelText('New arrival')).not.toBeInTheDocument();
  });

  it('uses the resolved media URL when the product has a photo', async () => {
    await renderCard(
      fakeProduct({ media: [{ id: 'm1', storageRef: 's3:x.png', url: 'https://cdn.example.com/x.png', type: 'IMAGE', sortOrder: 0 }] }),
    );
    expect(screen.getByRole('img', { name: 'Gold Ring' })).toHaveAttribute('src', expect.stringContaining('cdn.example.com'));
  });

  describe('quick-add', () => {
    it('adds the single variant directly, with no picker, for a single-option product', async () => {
      const user = userEvent.setup();
      await renderCard(fakeProduct());

      await user.click(screen.getByRole('button', { name: 'Add to bag' }));

      await waitFor(() => expect(addCartLineMock).toHaveBeenCalledWith(null, { variantId: 'v1', quantity: 1 }));
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    });

    it('confirms after adding', async () => {
      const user = userEvent.setup();
      await renderCard(fakeProduct());

      await user.click(screen.getByRole('button', { name: 'Add to bag' }));

      expect(await screen.findByRole('button', { name: 'Added' })).toBeInTheDocument();
    });

    it('opens an inline picker instead of adding blind when there is more than one option', async () => {
      const user = userEvent.setup();
      await renderCard(
        fakeProduct({
          variants: [
            { id: 'v1', sku: 'S1', metal: 'GOLD', purity: '18K', size: '6', weightGrams: '2', basePriceMinorUnits: 250000 },
            { id: 'v2', sku: 'S2', metal: 'GOLD', purity: '18K', size: '7', weightGrams: '2', basePriceMinorUnits: 250000 },
          ],
        }),
      );

      expect(screen.queryByRole('button', { name: 'Add to bag' })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Choose options' }));

      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
      expect(addCartLineMock).not.toHaveBeenCalled();
    });

    it('adds the chosen option from the inline picker, not the default one, once a different one is picked', async () => {
      const user = userEvent.setup();
      await renderCard(
        fakeProduct({
          variants: [
            { id: 'v1', sku: 'S1', metal: 'GOLD', purity: '18K', size: '6', weightGrams: '2', basePriceMinorUnits: 250000 },
            { id: 'v2', sku: 'S2', metal: 'GOLD', purity: '18K', size: '7', weightGrams: '2', basePriceMinorUnits: 250000 },
          ],
        }),
      );

      await user.click(screen.getByRole('button', { name: 'Choose options' }));
      await user.click(screen.getByRole('radio', { name: /7/ }));
      await user.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() => expect(addCartLineMock).toHaveBeenCalledWith(null, { variantId: 'v2', quantity: 1 }));
    });

    it('cancels back out of the picker without adding anything', async () => {
      const user = userEvent.setup();
      await renderCard(
        fakeProduct({
          variants: [
            { id: 'v1', sku: 'S1', metal: 'GOLD', purity: '18K', size: '6', weightGrams: '2', basePriceMinorUnits: 250000 },
            { id: 'v2', sku: 'S2', metal: 'GOLD', purity: '18K', size: '7', weightGrams: '2', basePriceMinorUnits: 250000 },
          ],
        }),
      );

      await user.click(screen.getByRole('button', { name: 'Choose options' }));
      await user.click(screen.getByRole('button', { name: 'Cancel choosing options' }));

      expect(screen.getByRole('button', { name: 'Choose options' })).toBeInTheDocument();
      expect(addCartLineMock).not.toHaveBeenCalled();
    });
  });

  describe('wishlist heart', () => {
    it('sends a logged-out visitor to log in rather than attempting a save', async () => {
      await renderCard(fakeProduct());
      const heart = screen.getByRole('link', { name: /log in to save/i });
      expect(heart).toHaveAttribute('href', '/login?next=/wishlist');
    });

    it('saves the cheapest variant, matching the price the card actually shows', async () => {
      useAuthStore.getState().setSession('t1', { id: 'u1', email: 'a@b.c', name: null, role: 'CUSTOMER' });
      const user = userEvent.setup();
      await renderCard(
        fakeProduct({
          variants: [
            { id: 'v1', sku: 'S1', metal: 'GOLD', purity: '18K', size: null, weightGrams: '2', basePriceMinorUnits: 250000 },
            { id: 'v2', sku: 'S2', metal: 'SILVER', purity: '925', size: null, weightGrams: '2', basePriceMinorUnits: 150000 },
          ],
        }),
      );

      const saveButton = await screen.findByRole('button', { name: /save gold ring/i });
      await user.click(saveButton);
      await waitFor(() => expect(addToWishlistMock).toHaveBeenCalledWith('t1', 'v2'));
      // Saving refetches the wishlist (mocked as still empty above), so the
      // button settling back to its unsaved label is what proves
      // react-query's invalidate-and-refetch cycle fully resolved, not just
      // that the mutation call itself fired.
      await screen.findByRole('button', { name: /save gold ring/i });
      // One more flush: react-query settles its own internal `isPending`
      // flag a tick after the refetched data lands, which is after the
      // assertion above already passed.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    });
  });
});
