import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BestsellersCarousel } from './bestsellers-carousel';
import type { Product } from '@/lib/api/types';

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

describe('BestsellersCarousel', () => {
  it('renders nothing when there are no products', () => {
    const { container } = render(<BestsellersCarousel products={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers no way back — a "previous" control does not exist', () => {
    const products = [1, 2, 3].map((n) => fakeProduct({ id: `p${n}`, name: `Ring ${n}`, slug: `ring-${n}` }));
    render(<BestsellersCarousel products={products} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Show the next bestseller' })).toBeInTheDocument();
  });

  it('hides the advance control when every product already fits on screen', () => {
    const products = [1, 2].map((n) => fakeProduct({ id: `p${n}`, name: `Ring ${n}`, slug: `ring-${n}` }));
    render(<BestsellersCarousel products={products} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('advancing slides the track forward by one item', async () => {
    const products = [1, 2, 3].map((n) => fakeProduct({ id: `p${n}`, name: `Ring ${n}`, slug: `ring-${n}` }));
    const user = userEvent.setup();
    render(<BestsellersCarousel products={products} />);

    const track = screen.getByRole('button', { name: 'Show the next bestseller' })
      .previousElementSibling!.firstElementChild as HTMLElement;
    expect(track.style.transform).toBe('translateX(-0%)');

    await user.click(screen.getByRole('button', { name: 'Show the next bestseller' }));
    expect(track.style.transform).toBe('translateX(-50%)');
  });

  it('loops back to the start instead of stopping at the last item — the infinite-scroll requirement', async () => {
    const products = [1, 2, 3].map((n) => fakeProduct({ id: `p${n}`, name: `Ring ${n}`, slug: `ring-${n}` }));
    const user = userEvent.setup();
    render(<BestsellersCarousel products={products} />);

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
});
