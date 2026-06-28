import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SearchResults } from './search-results';
import { useProducts } from '@/hooks/use-products';
import type { PaginatedResult, Product } from '@/lib/api/types';

vi.mock('@/hooks/use-products', () => ({ useProducts: vi.fn() }));

function fakeProduct(id: string): Product {
  return {
    id,
    name: `Product ${id}`,
    slug: id,
    description: 'd',
    status: 'PUBLISHED',
    certificationType: null,
    avgRating: '0',
    ratingCount: 0,
    category: { id: 'c1', name: 'Rings', slug: 'rings' },
    variants: [{ id: 'v1', sku: 'S1', metal: 'GOLD', purity: null, size: null, weightGrams: '1', basePriceMinorUnits: 1000 }],
    media: [],
  };
}

const emptyResult: PaginatedResult<Product> = { items: [], page: 1, pageSize: 24, total: 0 };

describe('SearchResults', () => {
  it('shows a loading skeleton while fetching', () => {
    (useProducts as any).mockReturnValue({ data: undefined, isFetching: true });
    render(<SearchResults query="ring" initialData={emptyResult} />);
    expect(screen.queryByText(/result/)).toBeInTheDocument(); // count text always shown
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows a "no results" message when the result set is empty', () => {
    (useProducts as any).mockReturnValue({ data: emptyResult, isFetching: false });
    render(<SearchResults query="nonexistent" initialData={emptyResult} />);
    expect(screen.getByText(/No products matched/)).toBeInTheDocument();
  });

  it('renders a product card per result', () => {
    const result: PaginatedResult<Product> = { items: [fakeProduct('p1'), fakeProduct('p2')], page: 1, pageSize: 24, total: 2 };
    (useProducts as any).mockReturnValue({ data: result, isFetching: false });
    render(<SearchResults query="ring" initialData={emptyResult} />);
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('falls back to initialData when the query has not resolved yet', () => {
    const initial: PaginatedResult<Product> = { items: [fakeProduct('p1')], page: 1, pageSize: 24, total: 1 };
    (useProducts as any).mockReturnValue({ data: undefined, isFetching: false });
    render(<SearchResults query="ring" initialData={initial} />);
    expect(screen.getByText(/^1 result for/)).toBeInTheDocument();
  });

  it('pluralizes the result count correctly', () => {
    const result: PaginatedResult<Product> = { items: [], page: 1, pageSize: 24, total: 5 };
    (useProducts as any).mockReturnValue({ data: result, isFetching: false });
    render(<SearchResults query="ring" initialData={emptyResult} />);
    expect(screen.getByText(/^5 results for/)).toBeInTheDocument();
  });
});
