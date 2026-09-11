import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BestsellersCarousel } from './bestsellers-carousel';
import type { Product } from '@/lib/api/types';

// Every slide is a ProductCard, which since the quick-add/wishlist overlay
// work now talks to the server through react-query (`useCart`,
// `useWishlistToggle`) — a bare `render()` throws "No QueryClient set"
// without a provider, and without mocking these the query would attempt a
// real, unmockable network fetch in jsdom.
vi.mock('@/lib/api/cart', () => ({
  addCartLine: vi.fn(),
  getCart: vi.fn().mockResolvedValue({ id: 'c1', userId: null, guestToken: 'g', items: [] }),
}));
vi.mock('@/lib/api/wishlist', () => ({
  getWishlist: vi.fn().mockResolvedValue({ id: 'w1', shareToken: 'tok', items: [] }),
  addToWishlist: vi.fn(),
  removeFromWishlist: vi.fn(),
}));

function renderCarousel(products: Product[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BestsellersCarousel products={products} />
    </QueryClientProvider>,
  );
}

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

/**
 * jsdom has no `matchMedia` at all (confirmed against jsdom 25 — calling it
 * throws "not a function"), so it has to be stubbed for any test that
 * exercises `useVisibleCount`. `matches` is fixed per stub rather than
 * simulating a live resize, since the component only reads it once on mount
 * plus a `change` listener it never needs to fire in these tests.
 */
function stubViewport(matchesDesktop: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: matchesDesktop,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BestsellersCarousel', () => {
  it('renders nothing when there are no products', () => {
    stubViewport(true);
    const { container } = renderCarousel([]);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers no way back — a "previous" control does not exist', () => {
    stubViewport(true);
    const products = [1, 2, 3].map((n) => fakeProduct({ id: `p${n}`, name: `Ring ${n}`, slug: `ring-${n}` }));
    renderCarousel(products);
    expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show the next bestseller' })).toBeInTheDocument();
  });

  it('hides the advance control when every product already fits on screen (desktop, 2 visible)', () => {
    stubViewport(true);
    const products = [1, 2].map((n) => fakeProduct({ id: `p${n}`, name: `Ring ${n}`, slug: `ring-${n}` }));
    renderCarousel(products);
    // Not "no buttons at all" — each slide is a ProductCard, which carries
    // its own quick-add button now. Only the carousel's own advance control
    // is what this test is about.
    expect(screen.queryByRole('button', { name: 'Show the next bestseller' })).not.toBeInTheDocument();
  });

  it('advancing slides the track forward by one item (desktop, 2 visible)', async () => {
    stubViewport(true);
    const products = [1, 2, 3].map((n) => fakeProduct({ id: `p${n}`, name: `Ring ${n}`, slug: `ring-${n}` }));
    const user = userEvent.setup();
    renderCarousel(products);

    const track = screen.getByRole('button', { name: 'Show the next bestseller' })
      .previousElementSibling!.firstElementChild as HTMLElement;
    expect(track.style.transform).toBe('translateX(-0%)');

    await user.click(screen.getByRole('button', { name: 'Show the next bestseller' }));
    expect(track.style.transform).toBe('translateX(-50%)');
  });

  it('loops back to the start instead of stopping at the last item — the infinite-scroll requirement', async () => {
    stubViewport(true);
    const products = [1, 2, 3].map((n) => fakeProduct({ id: `p${n}`, name: `Ring ${n}`, slug: `ring-${n}` }));
    const user = userEvent.setup();
    renderCarousel(products);

    const button = screen.getByRole('button', { name: 'Show the next bestseller' });
    const track = button.previousElementSibling!.firstElementChild as HTMLElement;

    // 3 products, 2 visible: clicking 3 times walks past the real end into
    // the appended duplicate of the start.
    await user.click(button);
    await user.click(button);
    await user.click(button);
    expect(track.style.transform).toBe('translateX(-150%)');

    // The transitionend handler (fired manually here — jsdom doesn't run
    // real CSS transitions) is what performs the invisible reset to index 0.
    act(() => {
      track.dispatchEvent(new Event('transitionend', { bubbles: true }));
    });
    expect(track.style.transform).toBe('translateX(-0%)');

    // Still showing real product 1's name — the loop landed back on real
    // content, not on an empty or broken slide.
    expect(screen.getAllByText('Ring 1').length).toBeGreaterThan(0);
  });

  describe('on mobile (below the sm breakpoint)', () => {
    it('shows one card at a time, full width — the mobile bug this guards against', () => {
      stubViewport(false);
      const products = [1, 2].map((n) => fakeProduct({ id: `p${n}`, name: `Ring ${n}`, slug: `ring-${n}` }));
      renderCarousel(products);

      // 2 products no longer "already fit" once only 1 is visible — unlike
      // the desktop case above, the advance control must appear.
      const button = screen.getByRole('button', { name: 'Show the next bestseller' });
      const track = button.previousElementSibling!.firstElementChild as HTMLElement;

      const [firstSlide] = track.children;
      expect(firstSlide).toHaveClass('w-full');
      expect(track.style.transform).toBe('translateX(-0%)');
    });

    it('advancing slides the track forward by a full 100% — one card per click', async () => {
      stubViewport(false);
      const products = [1, 2, 3].map((n) => fakeProduct({ id: `p${n}`, name: `Ring ${n}`, slug: `ring-${n}` }));
      const user = userEvent.setup();
      renderCarousel(products);

      const button = screen.getByRole('button', { name: 'Show the next bestseller' });
      const track = button.previousElementSibling!.firstElementChild as HTMLElement;

      await user.click(button);
      expect(track.style.transform).toBe('translateX(-100%)');
    });
  });
});
