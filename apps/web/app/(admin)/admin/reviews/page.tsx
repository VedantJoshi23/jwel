'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RatingStars } from '@/components/product/rating-stars';
import { useAuthStore } from '@/lib/auth-store';
import { adminListPendingReviews, adminModerateReview } from '@/lib/api/admin-reviews';
import { ApiError } from '@/lib/api/client';
import type { AdminReview } from '@/lib/api/types';

/**
 * `FEAT-ADMIN-REVIEW-MODERATION`.
 *
 * `GET /admin/reviews/pending` and `PATCH /admin/reviews/:id/moderate` are
 * real endpoints, built alongside `FEAT-RATING-OWNERSHIP` — nothing in the
 * admin frontend has ever called either until this page. In practice that
 * meant every review submitted since launch stayed permanently `PENDING`:
 * the dashboard showed a count with no way to act on it.
 */
export default function AdminReviewsPage() {
  const token = useAuthStore((state) => state.token);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    adminListPendingReviews(token)
      .then(setReviews)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load pending reviews'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(load, [load]);

  async function handleModerate(reviewId: string, status: 'APPROVED' | 'REJECTED') {
    if (!token) return;
    setBusyId(reviewId);
    setError('');
    try {
      await adminModerateReview(token, reviewId, status);
      // Refetches rather than filtering the moderated row out of local
      // state — the count on the dashboard's stat card and this list must
      // never be able to drift, and a refetch is what guarantees that.
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update this review');
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Review moderation</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Reviews awaiting a decision. Approving one makes it public on the product page and
          recomputes that product&apos;s rating.
        </p>
      </div>

      {error && (
        <p role="alert" className="mb-4 text-sm text-feedback-error">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-ink-secondary">Loading…</p>
      ) : reviews.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-ink-secondary">No reviews awaiting moderation.</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => (
            <li key={review.id}>
              <Card>
                <CardContent>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <Link
                        href={`/product/${review.product.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium underline"
                      >
                        {review.product.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {review.user.name ?? review.user.email}
                        {review.verifiedPurchase && (
                          <span className="ml-2 text-feedback-success">Verified purchase</span>
                        )}
                      </p>
                    </div>
                    <RatingStars value={review.rating} />
                  </div>

                  {review.title && <p className="mt-3 font-medium">{review.title}</p>}
                  <p className="mt-1 text-sm text-ink-secondary">{review.body}</p>

                  <div className="mt-4 flex gap-2">
                    <Button
                      size="s"
                      loading={busyId === review.id}
                      onClick={() => handleModerate(review.id, 'APPROVED')}
                    >
                      Approve
                    </Button>
                    <Button
                      size="s"
                      variant="destructive"
                      loading={busyId === review.id}
                      onClick={() => handleModerate(review.id, 'REJECTED')}
                    >
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
