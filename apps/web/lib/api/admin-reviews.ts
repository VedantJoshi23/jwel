import { apiFetch } from './client';
import type { AdminReview } from './types';

/**
 * `FEAT-ADMIN-REVIEW-MODERATION`. Bare array, not `PaginatedResult` — matches
 * the actual shape `ReviewsService.adminListPending` returns (no `count()`
 * call), the same reasoning `admin-returns.ts` already documents for its own
 * list endpoint: pending-review volume doesn't need pagination yet.
 */
export function adminListPendingReviews(token: string) {
  return apiFetch<AdminReview[]>('/admin/reviews/pending', { token, cache: 'no-store' });
}

export function adminModerateReview(token: string, reviewId: string, status: 'APPROVED' | 'REJECTED') {
  return apiFetch<AdminReview>(`/admin/reviews/${reviewId}/moderate`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ status }),
  });
}
