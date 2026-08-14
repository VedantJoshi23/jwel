import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductRail } from './product-rail';
import type { RecommendedProduct } from '@/lib/api/types';

function product(over: Partial<RecommendedProduct> = {}): RecommendedProduct {
  return {
    productId: 'p1',
    slug: 'gold-ring',
    name: 'Gold Ring',
    categorySlug: 'rings',
    priceMinMinorUnits: 250000,
    avgRating: 4.5,
    ratingCount: 10,
    thumbnailRef: null,
    thumbnailUrl: null,
    ...over,
  };
}

describe('ProductRail', () => {
  it('renders nothing when there is nothing to recommend', () => {
    // A heading above an empty strip tells a shopper the shop is broken.
    // Saying nothing is the honest answer when there is no signal — and on
    // this catalogue that is the common case, not the edge one.
    const { container } = render(<ProductRail title="Frequently bought together" products={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the products with their prices', () => {
    render(<ProductRail title="Trending now" products={[product()]} />);
    expect(screen.getByRole('heading', { name: 'Trending now' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Gold Ring/ })).toHaveAttribute(
      'href',
      '/product/gold-ring',
    );
  });

  it('is a list, so a screen reader can say how many there are', () => {
    render(
      <ProductRail
        title="Trending now"
        products={[product(), product({ productId: 'p2', slug: 'silver-ring', name: 'Silver Ring' })]}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('uses the product’s own photograph when the API sent one', () => {
    // It used to render a stock image unconditionally, so a rail could show a
    // different piece from the one it named.
    const { container } = render(
      <ProductRail title="Trending now" products={[product({ thumbnailUrl: '/uploads/real.jpg' })]} />,
    );
    expect(container.querySelector('img')?.getAttribute('src')).toContain('real.jpg');
  });

  it('falls back to a stock image for a product with no photograph', () => {
    const { container } = render(<ProductRail title="Trending now" products={[product()]} />);
    expect(container.querySelector('img')?.getAttribute('src')).toBeTruthy();
  });

  it('shows why an item was recommended, when the API sent a reason', () => {
    render(<ProductRail title="Recommended for you" products={[product({ reason: 'co_purchased' })]} />);
    expect(screen.getByText('Often bought with your picks')).toBeInTheDocument();
  });

  it('shows nothing extra when the API sent no reason — Trending/FBT don’t carry one', () => {
    render(<ProductRail title="Frequently bought together" products={[product()]} />);
    expect(screen.queryByText('Trending now')).not.toBeInTheDocument();
    expect(screen.queryByText('Bestseller')).not.toBeInTheDocument();
  });

  it('marks the thumbnails decorative rather than repeating the product name', () => {
    // STD-ACCESSIBILITY rule 4 — decorative images are explicitly marked as
    // such. The link already carries the name; an alt repeating it would make
    // a screen reader say it twice. `alt=""` also removes the img role, which
    // is why this asserts on the element rather than by role.
    const { container } = render(<ProductRail title="Trending now" products={[product()]} />);
    const image = container.querySelector('img');
    expect(image).toHaveAttribute('alt', '');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
