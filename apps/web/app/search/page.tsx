import type { Metadata } from 'next';
import { getProducts } from '@/lib/api/products';
import { SearchResults } from '@/components/common/search-results';
import type { PaginatedResult, Product } from '@/lib/api/types';

export const metadata: Metadata = {
  title: 'Search',
  robots: { index: false }, // search-results pages aren't canonical content — NFR-7
};

const EMPTY_RESULT: PaginatedResult<Product> = { items: [], page: 1, pageSize: 24, total: 0 };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const query = searchParams.q?.trim() ?? '';

  let initialData = EMPTY_RESULT;
  if (query) {
    try {
      initialData = await getProducts({ q: query, pageSize: 24 }, false);
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
