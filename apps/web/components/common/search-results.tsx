'use client';

import { useState } from 'react';
import { useProducts } from '@/hooks/use-products';
import { ProductCard } from '@/components/product/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import type { PaginatedResult, Product } from '@/lib/api/types';
import type { ProductSort } from '@/lib/api/products';

export function SearchResults({
  query,
  initialData,
}: {
  query: string;
  initialData: PaginatedResult<Product>;
}) {
  const [sort, setSort] = useState<ProductSort>('newest');
  const { data, isFetching } = useProducts({ q: query, sort, pageSize: 24 });
  const result = data ?? initialData;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-ink-secondary" aria-live="polite">
          {result.total} result{result.total === 1 ? '' : 's'} for &ldquo;{query}&rdquo;
        </p>
        <label className="flex items-center gap-2 text-sm">
          Sort by
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as ProductSort)}
            className="rounded-s border border-border bg-surface px-2 py-1.5"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="popularity">Popularity</option>
          </select>
        </label>
      </div>

      {isFetching && (
        <div className="mb-4 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      )}

      {!isFetching && result.items.length === 0 && (
        <p className="py-12 text-center text-ink-secondary">
          No products matched &ldquo;{query}&rdquo;. Try a different search term.
        </p>
      )}

      {!isFetching && result.items.length > 0 && (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {result.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
