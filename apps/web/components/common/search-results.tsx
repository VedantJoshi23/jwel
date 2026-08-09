'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { searchProducts } from '@/lib/api/search';
import { formatMinorUnits } from '@/lib/money';
import { getProductStockImage } from '@/lib/jewellery-images';
import type { SearchHit, SearchResult } from '@/lib/api/types';

/**
 * Search results, from the **search module** rather than `/products?q=`.
 *
 * KC-116: the storefront called the Postgres trigram fallback, whose own DTO
 * says Elasticsearch is the primary path. `FR-3` asks for typo tolerance, and
 * a trigram match does not provide it.
 *
 * **There is no sort control any more, and that is the point.** Results are
 * ordered by *relevance* — how well each product matches what was typed — and
 * `/search` has no sort parameter because a relevance search re-sorted by
 * "newest" is no longer a relevance search. The old dropdown worked against
 * `/products`, and keeping it here would have left a control that quietly did
 * nothing. Category listings still sort, where sorting is the whole idea.
 */
export function SearchResults({
  query,
  initialData,
}: {
  query: string;
  initialData: SearchResult;
}) {
  const { data, isFetching } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchProducts({ q: query, pageSize: 24 }, false),
    initialData,
    retry: false,
  });

  const result = data ?? initialData;
  // Skeletons only when there is genuinely nothing to show. The page renders
  // results on the server, and react-query refetches on mount — hiding them
  // while that happens would blank a page that was already correct.
  const showSkeletons = isFetching && result.items.length === 0;

  return (
    <div>
      <p className="mb-6 text-sm text-ink-secondary" aria-live="polite">
        {result.total} result{result.total === 1 ? '' : 's'} for &ldquo;{query}&rdquo;
      </p>

      {showSkeletons && (
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

      {result.items.length > 0 && (
        <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {result.items.map((hit) => (
            <li key={hit.productId}>
              <SearchHitCard hit={hit} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * A search hit is not a `Product` — it carries no variants, which is what
 * `ProductCard` derives its price range from. Rendering it through that card
 * would mean inventing the missing half; the API already computed the price
 * range, so this shows what the search actually returned.
 */
function SearchHitCard({ hit }: { hit: SearchHit }) {
  const hasRange = hit.priceMaxMinorUnits > hit.priceMinMinorUnits;

  return (
    <Link href={`/product/${hit.slug}`} className="group block bg-surface">
      <div className="relative aspect-square overflow-hidden bg-surface-alt">
        <Image
          src={getProductStockImage(hit.slug)}
          alt=""
          fill
          sizes="(min-width: 1024px) 25vw, 50vw"
          className="object-cover transition-transform group-hover:scale-105"
        />
      </div>
      <p className="mt-2 text-sm font-medium">{hit.name}</p>
      <p className="text-xs text-ink-muted">{hit.categoryName}</p>
      <p className="mt-0.5 text-sm">
        {formatMinorUnits(hit.priceMinMinorUnits)}
        {hasRange && <span className="text-ink-muted"> – {formatMinorUnits(hit.priceMaxMinorUnits)}</span>}
      </p>
      {/* Text, not colour alone — STD-ACCESSIBILITY rule 6. */}
      {!hit.inStock && <p className="mt-0.5 text-xs text-feedback-warning">Out of stock</p>}
    </Link>
  );
}
