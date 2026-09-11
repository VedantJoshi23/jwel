import { Skeleton } from '@/components/ui/skeleton';

/**
 * Route-level fallback for storefront navigations. Before this existed the
 * browser simply sat on the previous page while a server component fetched,
 * with nothing to indicate the click had registered.
 *
 * Shaped like a product grid because that is what most storefront routes
 * resolve to. A skeleton that does not resemble what follows causes a visible
 * reflow, which reads as slower than no skeleton at all.
 */
export default function StorefrontLoading() {
  return (
    <div className="px-6 py-10 lg:px-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />

      <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-x-6">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i}>
            <Skeleton className="aspect-square w-full rounded-m" />
            <Skeleton className="mt-3 h-4 w-3/4" />
            <Skeleton className="mt-2 h-4 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
