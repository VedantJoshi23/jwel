import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddToCart } from './add-to-cart';
import { useCartStore } from '@/lib/cart-store';
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
    useCartStore.getState().clear();
  });

  it('shows an unavailable message when the product has no variants', () => {
    renderWithQuery(<AddToCart product={fakeProduct({ variants: [] })} />);
    expect(screen.getByText('This product is currently unavailable.')).toBeInTheDocument();
  });

  it('adds the selected variant and quantity to the cart on click', () => {
    renderWithQuery(<AddToCart product={fakeProduct()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to bag' }));

    const lines = useCartStore.getState().lines;
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ variantId: 'v1', productName: 'Gold Ring', quantity: 1 });
  });

  it('shows a confirmation message after adding, then clears it after a delay', () => {
    renderWithQuery(<AddToCart product={fakeProduct()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to bag' }));
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
