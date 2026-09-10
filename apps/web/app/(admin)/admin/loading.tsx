import { Skeleton } from '@/components/ui/skeleton';

/**
 * Admin's route-level fallback. Shaped like a table because every admin screen
 * except the dashboard is one, so the skeleton settles into the real layout
 * instead of jumping when data arrives.
 */
export default function AdminLoading() {
  return (
    <div className="px-6 py-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      <Skeleton className="h-8 w-48" />

      <div className="mt-8 space-y-3">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
