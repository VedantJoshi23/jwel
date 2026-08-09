import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddToCart } from './add-to-cart';
import { addCartLine } from '@/lib/api/cart';

// The bag is on the server now, so adding is an API call rather than a store
// write. Mocked here because this file is about the control, not the cart.
vi.mock('@/lib/api/cart', () => ({
  getCart: vi.fn().mockResolvedValue({ id: 'c1', userId: null, guestToken: 'g', items: [] }),
  addCartLine: vi.fn().mockResolvedValue({ id: 'c1', items: [] }),
  updateCartLine: vi.fn(),
  removeCartLine: vi.fn(),
  clearCart: vi.fn(),
  claimGuestCart: vi.fn(),
}));

const add = vi.mocked(addCartLine);
import type { Product } from '@/lib/api/types';

/**
 * AddToCart now renders SaveToWishlist, which reads the wishlist through
 * react-query. The app supplies a client at the root layout
 * (providers/query-provider); an isolated render has to supply its own.
 */
function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

vi.useFakeTimers();

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

describe('AddToCart', () => {
  beforeEach(() => {
    add.mockClear();
  });

  it('shows an unavailable message when the product has no variants', () => {
    renderWithQuery(<AddToCart product={fakeProduct({ variants: [] })} />);
    expect(screen.getByText('This product is currently unavailable.')).toBeInTheDocument();
  });

  it('adds the selected variant and quantity to the cart on click', async () => {
    renderWithQuery(<AddToCart product={fakeProduct()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to bag' }));
    // The write is a request now, so the assertion has to wait for it. Flushed
    // with act rather than waitFor because this file runs on fake timers.
    await act(async () => {});

    // Variant and quantity only. The server holds the name and the price, so
    // nothing sent from here can disagree with the catalogue — the old local
    // cart carried a copy of both and could drift.
    expect(add).toHaveBeenCalledWith(null, { variantId: 'v1', quantity: 1 });
  });

  it('shows a confirmation message after adding, then clears it after a delay', async () => {
    renderWithQuery(<AddToCart product={fakeProduct()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to bag' }));
    await act(async () => {});
    expect(screen.getByRole('status')).toHaveTextContent('Added Gold Ring to your bag.');

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('multiplies price by the selected quantity', () => {
    renderWithQuery(<AddToCart product={fakeProduct()} />);
    fireEvent.click(screen.getByLabelText('Increase quantity'));
    expect(screen.getByText('₹5,000')).toBeInTheDocument(); // 2500 * 2
  });
});
