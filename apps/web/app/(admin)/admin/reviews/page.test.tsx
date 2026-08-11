import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminReviewsPage from './page';
import { useAuthStore } from '@/lib/auth-store';
import { adminListPendingReviews, adminModerateReview } from '@/lib/api/admin-reviews';
import type { AdminReview } from '@/lib/api/types';

vi.mock('@/lib/api/admin-reviews', () => ({
  adminListPendingReviews: vi.fn(),
  adminModerateReview: vi.fn(),
}));

const listPending = vi.mocked(adminListPendingReviews);
const moderate = vi.mocked(adminModerateReview);

function makeReview(overrides: Partial<AdminReview> = {}): AdminReview {
  return {
    id: 'r1',
    rating: 4,
    title: 'Lovely piece',
    body: 'Exactly as pictured.',
    verifiedPurchase: true,
    moderationStatus: 'PENDING',
    createdAt: '2026-08-11T00:00:00Z',
    product: { id: 'p1', name: 'Diamond Halo Ring', slug: 'diamond-halo-ring' },
    user: { id: 'u1', email: 'customer@example.com', name: null },
    ...overrides,
  };
}

describe('AdminReviewsPage — FEAT-ADMIN-REVIEW-MODERATION', () => {
  beforeEach(() => {
    listPending.mockReset();
    moderate.mockReset();
    listPending.mockResolvedValue([makeReview()]);
    useAuthStore.getState().setSession('token-1', {
      id: 'admin1',
      email: 'admin@example.com',
      name: null,
      role: 'ADMIN',
    });
  });
  afterEach(() => useAuthStore.getState().logout());

  it('shows which product the review is about by name, not a raw id — Acceptance Criterion 5', async () => {
    render(<AdminReviewsPage />);
    expect(await screen.findByText('Diamond Halo Ring')).toBeInTheDocument();
  });

  it('shows who wrote it, falling back to email when there is no name', async () => {
    render(<AdminReviewsPage />);
    await screen.findByText('Diamond Halo Ring');
    expect(screen.getByText('customer@example.com')).toBeInTheDocument();
  });

  it('prefers the display name over the email when one exists', async () => {
    listPending.mockResolvedValue([makeReview({ user: { id: 'u1', email: 'c@example.com', name: 'Priya' } })]);
    render(<AdminReviewsPage />);
    expect(await screen.findByText('Priya')).toBeInTheDocument();
    expect(screen.queryByText('c@example.com')).not.toBeInTheDocument();
  });

  it('says plainly when the queue is empty rather than rendering nothing — Acceptance Criterion 7', async () => {
    listPending.mockResolvedValue([]);
    render(<AdminReviewsPage />);
    expect(await screen.findByText('No reviews awaiting moderation.')).toBeInTheDocument();
  });

  it('approve is one click and reloads the list', async () => {
    moderate.mockResolvedValue(makeReview({ moderationStatus: 'APPROVED' }));
    render(<AdminReviewsPage />);
    await screen.findByText('Diamond Halo Ring');

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(moderate).toHaveBeenCalledWith('token-1', 'r1', 'APPROVED'));
    await waitFor(() => expect(listPending).toHaveBeenCalledTimes(2));
  });

  it('reject is one click too, not a separate confirmation flow', async () => {
    moderate.mockResolvedValue(makeReview({ moderationStatus: 'REJECTED' }));
    render(<AdminReviewsPage />);
    await screen.findByText('Diamond Halo Ring');

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

    await waitFor(() => expect(moderate).toHaveBeenCalledWith('token-1', 'r1', 'REJECTED'));
  });

  it('a failed moderation call leaves the row in place and shows an inline error, rather than the row silently vanishing', async () => {
    moderate.mockRejectedValue(new Error('network down'));
    render(<AdminReviewsPage />);
    await screen.findByText('Diamond Halo Ring');

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to update this review');
    expect(screen.getByText('Diamond Halo Ring')).toBeInTheDocument();
    expect(listPending).toHaveBeenCalledTimes(1);
  });

  it('shows a review whose product was since unpublished the same as any other — no product-status filter', async () => {
    // adminListPending has no such filter server-side either; this just
    // proves the page renders whatever it's given without gatekeeping.
    listPending.mockResolvedValue([makeReview({ product: { id: 'p2', name: 'Archived Ring', slug: 'archived-ring' } })]);
    render(<AdminReviewsPage />);
    expect(await screen.findByText('Archived Ring')).toBeInTheDocument();
  });

  it('still shows the reviewer for a soft-deleted user — moderation is not the anonymous-display rule', async () => {
    // DOM-REVIEWS Invariant 8 anonymises the *public* display; it is not a
    // moderator-facing rule, and this page must not apply it.
    listPending.mockResolvedValue([makeReview({ user: { id: 'u2', email: 'gone@example.com', name: null } })]);
    render(<AdminReviewsPage />);
    expect(await screen.findByText('gone@example.com')).toBeInTheDocument();
  });
});
