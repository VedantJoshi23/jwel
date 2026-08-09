import type { Metadata } from 'next';
import { searchProducts } from '@/lib/api/search';
import { SearchResults } from '@/components/common/search-results';
import type { SearchResult } from '@/lib/api/types';

export const metadata: Metadata = {
  title: 'Search',
  robots: { index: false }, // search-results pages aren't canonical content — NFR-7
};

const EMPTY_RESULT: SearchResult = {
  items: [],
  page: 1,
  pageSize: 24,
  total: 0,
  facets: { metals: [], categories: [], certifications: [], priceRanges: [] },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams.q?.trim() ?? '';

  let initialData = EMPTY_RESULT;
  if (query) {
    try {
      // `/search` rather than `/products?q=` — the Elasticsearch path, which
      // degrades to the same Postgres query server-side when Elasticsearch is
      // unreachable. The client is never the one deciding (KC-124).
      initialData = await searchProducts({ q: query, pageSize: 24 }, false);
    } catch {
      initialData = EMPTY_RESULT;
    }
  }

  return (
    <div className="px-6 py-10 lg:px-8">
      <h1 className="mb-6 font-display text-3xl font-bold">Search</h1>
      {query ? (
        <SearchResults query={query} initialData={initialData} />
      ) : (
        <p className="text-ink-secondary">Enter a search term to find products.</p>
      )}
    </div>
  );
}
