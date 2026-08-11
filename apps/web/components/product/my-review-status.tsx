'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { getMyReview } from '@/lib/api/products';
import { RatingStars } from './rating-stars';
import { Badge } from '@/components/ui/badge';

interface MyReviewStatusProps {
  productId: string;
  /**
   * What to render in this slot when the visitor has no non-public review to
   * show — the page's own "No reviews yet" text, passed in rather than
   * hardcoded here, so this component decides *whether* the empty state
   * applies without needing to know its copy. `FEAT-PENDING-REVIEW-VISIBILITY`
   * §7 edge case 5: showing "No reviews yet" next to the visitor's own
   * pending review would read as a direct contradiction, so whichever one
   * applies replaces the other rather than both rendering.
   */
  emptyFallback?: React.ReactNode;
}

/**
 * A reviewer's own review, in any state the public list wouldn't show.
 *
 * `DOM-REVIEWS` Invariant 3 (narrowed 2026-08-11): a review is invisible to
 * the *public* until `APPROVED`, not invisible to its own author. Before
 * this, a submitted review gave its author a toast that faded in seconds and
 * then nothing — reported directly as "I wrote a review, but I can't see it
 * anywhere." This is the fix, and it works on a later visit as well as the
 * same session, because it is backed by a real query (`getMyReview`) rather
 * than post-submit local state.
 *
 * Renders nothing (or `emptyFallback`) when: signed out, loading, no review
 * exists yet, or the review is already `APPROVED` — that last case is
 * deliberate, not an oversight: an approved review already appears in the
 * public list this component sits beside, and showing it twice would be the
 * bug, not the fix (§7 edge case 3).
 */
export function MyReviewStatus({ productId, emptyFallback = null }: MyReviewStatusProps) {
  const { token, isAuthenticated } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['myReview', productId],
    queryFn: () => getMyReview(token!, productId),
    enabled: isAuthenticated && Boolean(token),
  });

  if (!isAuthenticated || isLoading || !data || data.moderationStatus === 'APPROVED') {
    return <>{emptyFallback}</>;
  }

  const pending = data.moderationStatus === 'PENDING';

  return (
    <div
      role="status"
      className="material-card mb-6 max-w-2xl rounded-m border border-border p-4"
    >
      <div className="flex items-center gap-3">
        <RatingStars value={data.rating} />
        <Badge variant={pending ? 'warning' : 'error'}>
          {pending ? 'Pending approval' : 'Not approved'}
        </Badge>
      </div>
      {data.title && <p className="mt-2 font-medium">{data.title}</p>}
      <p className="mt-1 text-sm text-ink-secondary">{data.body}</p>
      <p className="mt-2.5 text-xs text-ink-muted">
        {pending
          ? 'Visible only to you until our team reviews it.'
          : "This review wasn't approved for publication."}
      </p>
    </div>
  );
}
