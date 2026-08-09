import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SearchResults } from './search-results';
import { searchProducts } from '@/lib/api/search';
import type { SearchHit, SearchResult } from '@/lib/api/types';

vi.mock('@/lib/api/search', () => ({ searchProducts: vi.fn(), autocomplete: vi.fn() }));
const search = vi.mocked(searchProducts);

function hit(over: Partial<SearchHit> = {}): SearchHit {
  return {
    productId: 'p1',
    slug: 'diamond-halo-ring',
    name: 'Diamond Halo Ring',
    categorySlug: 'rings',
    categoryName: 'Rings',
    priceMinMinorUnits: 250000,
    priceMaxMinorUnits: 250000,
    avgRating: 4.5,
    ratingCount: 10,
    inStock: true,
    ...over,
  };
}

function result(items: SearchHit[] = [hit()], total = items.length): SearchResult {
  return {
    items,
    total,
    page: 1,
    pageSize: 24,
    facets: { metals: [], categories: [], certifications: [], priceRanges: [] },
  };
}

function renderResults(initial: SearchResult = result()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SearchResults query="diamond" initialData={initial} />
    </QueryClientProvider>,
  );
}

describe('SearchResults', () => {
  beforeEach(() => {
    search.mockReset();
    search.mockResolvedValue(result());
  });

  it('queries the search module, not the products fallback', async () => {
    // KC-116: the storefront called /products?q=, whose own DTO calls that
    // path the Postgres trigram fallback.
    renderResults();
    await waitFor(() =>
      expect(search).toHaveBeenCalledWith({ q: 'diamond', pageSize: 24 }, false),
    );
  });

  it('shows the result count and the hits', () => {
    renderResults();
    expect(screen.getByText(/1 result for/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Diamond Halo Ring/ })).toHaveAttribute(
      'href',
      '/product/diamond-halo-ring',
    );
  });

  it('offers no sort control, because results are ordered by relevance', () => {
    // /search has no sort parameter — a relevance search re-sorted by "newest"
    // is not a relevance search. Keeping the old dropdown would have left a
    // control that quietly did nothing.
    renderResults();
    expect(screen.queryByLabelText(/Sort by/)).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows a price range only when the variants differ', () => {
    renderResults(result([hit({ priceMaxMinorUnits: 400000 })]));
    expect(screen.getByText(/–/)).toBeInTheDocument();
  });

  it('says when nothing matched', async () => {
    // Waits for the refetch: with no results there is nothing to keep on
    // screen, so this is the one case that shows skeletons first.
    search.mockResolvedValue(result([], 0));
    renderResults(result([], 0));
    expect(await screen.findByText(/No products matched/)).toBeInTheDocument();
  });

  it('marks an out-of-stock hit in words, not colour alone', () => {
    renderResults(result([hit({ inStock: false })]));
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
  });

  it('renders the server-rendered results before the client query resolves', () => {
    // The page fetches once on the server; a blank flash while the client
    // refetches would undo that.
    search.mockImplementation(() => new Promise(() => {}));
    renderResults();
    expect(screen.getByRole('link', { name: /Diamond Halo Ring/ })).toBeInTheDocument();
  });
});
