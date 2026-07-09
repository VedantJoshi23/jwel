import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductCard } from './product-card';
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
    category: { id: 'c1', name: 'Rings', slug: 'rings' },
    variants: [{ id: 'v1', sku: 'S1', metal: 'GOLD', purity: '18K', size: null, weightGrams: '2', basePriceMinorUnits: 250000 }],
    media: [],
    ...overrides,
  };
}

describe('ProductCard', () => {
  it('links to the product detail page', () => {
    render(<ProductCard product={fakeProduct()} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/product/gold-ring');
  });

  it('shows the product name and lowest variant price', () => {
    render(<ProductCard product={fakeProduct()} />);
    expect(screen.getByText('Gold Ring')).toBeInTheDocument();
    expect(screen.getByText('₹2,500')).toBeInTheDocument();
  });

  it('shows the lowest price across multiple variants', () => {
    render(
      <ProductCard
        product={fakeProduct({
          variants: [
            { id: 'v1', sku: 'S1', metal: 'GOLD', purity: '18K', size: null, weightGrams: '2', basePriceMinorUnits: 250000 },
            { id: 'v2', sku: 'S2', metal: 'GOLD', purity: '18K', size: null, weightGrams: '3', basePriceMinorUnits: 150000 },
          ],
        })}
      />,
    );
    expect(screen.getByText('₹1,500')).toBeInTheDocument();
  });

  it('omits the rating stars when avgRating is 0', () => {
    // Scoped to the rating stars' own accessible name — the card's product
    // photo is also role="img" (a real `next/image` `<img alt="...">`,
    // present regardless of rating), so an unscoped query here was matching
    // the wrong element instead of asserting anything about rating stars.
    render(<ProductCard product={fakeProduct({ avgRating: '0' })} />);
    expect(screen.queryByRole('img', { name: /out of 5 stars/i })).not.toBeInTheDocument();
  });

  it('shows rating stars when avgRating is positive', () => {
    render(<ProductCard product={fakeProduct({ avgRating: '4.5', ratingCount: 10 })} />);
    expect(screen.getByRole('img', { name: /out of 5 stars/i })).toBeInTheDocument();
  });

  it('shows the NEW ARRIVAL badge when isNew is true', () => {
    render(<ProductCard product={fakeProduct()} isNew />);
    expect(screen.getByLabelText('New arrival')).toBeInTheDocument();
  });

  it('omits the NEW ARRIVAL badge by default', () => {
    render(<ProductCard product={fakeProduct()} />);
    expect(screen.queryByLabelText('New arrival')).not.toBeInTheDocument();
  });

  it('uses the resolved media URL when the product has a photo', () => {
    render(
      <ProductCard
        product={fakeProduct({ media: [{ id: 'm1', storageRef: 's3:x.png', url: 'https://cdn.example.com/x.png', type: 'IMAGE', sortOrder: 0 }] })}
      />,
    );
    expect(screen.getByRole('img', { name: 'Gold Ring' })).toHaveAttribute('src', expect.stringContaining('cdn.example.com'));
  });
});
