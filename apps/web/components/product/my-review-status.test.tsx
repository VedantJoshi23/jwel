import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MyReviewStatus } from './my-review-status';
import { useAuthStore } from '@/lib/auth-store';
import { getMyReview } from '@/lib/api/products';

vi.mock('@/lib/api/products', () => ({ getMyReview: vi.fn() }));

const getMine = vi.mocked(getMyReview);

function renderIt(props: Partial<React.ComponentProps<typeof MyReviewStatus>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MyReviewStatus productId="p1" {...props} />
    </QueryClientProvider>,
  );
}

function signIn() {
  useAuthStore.getState().setSession('token-1', { id: 'u1', email: 'a@b.c', name: null, role: 'CUSTOMER' });
}

const review = (over: Partial<{ rating: number; title: string | null; body: string; moderationStatus: string }> = {}) => ({
  id: 'r1',
  productId: 'p1',
  userId: 'u1',
  rating: 4,
  title: 'Lovely piece',
  body: 'Exactly as pictured.',
  verifiedPurchase: true,
  createdAt: '2026-08-01T00:00:00Z',
  moderationStatus: 'PENDING',
  ...over,
});

describe('MyReviewStatus — FEAT-PENDING-REVIEW-VISIBILITY', () => {
  beforeEach(() => getMine.mockReset());
  afterEach(() => useAuthStore.getState().logout());

  it('renders nothing for a signed-out visitor, and never calls the API', () => {
    const { container } = renderIt();
    expect(container).toBeEmptyDOMElement();
    expect(getMine).not.toHaveBeenCalled();
  });

  it('shows a pending review labelled distinctly, not mixed into the public list unlabelled', async () => {
    signIn();
    getMine.mockResolvedValue(review({ moderationStatus: 'PENDING' }) as never);
    renderIt();

    expect(await screen.findByText('Pending approval')).toBeInTheDocument();
    expect(screen.getByText('Lovely piece')).toBeInTheDocument();
    expect(screen.getByText(/Visible only to you/)).toBeInTheDocument();
  });

  it('shows a rejected review too — an author told "submitted" should not see it silently vanish', async () => {
    signIn();
    getMine.mockResolvedValue(review({ moderationStatus: 'REJECTED' }) as never);
    renderIt();

    expect(await screen.findByText('Not approved')).toBeInTheDocument();
  });

  it('renders nothing for an already-approved review — it is already in the public list this sits beside, showing it twice would be the bug', async () => {
    signIn();
    getMine.mockResolvedValue(review({ moderationStatus: 'APPROVED' }) as never);
    const { container } = renderIt();

    await waitFor(() => expect(getMine).toHaveBeenCalled());
    expect(screen.queryByText('Pending approval')).not.toBeInTheDocument();
    expect(screen.queryByText('Not approved')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('falls back to the caller-supplied empty state when there is nothing of its own to show', async () => {
    signIn();
    getMine.mockResolvedValue(null);
    renderIt({ emptyFallback: <p>No reviews yet for this product.</p> });

    expect(await screen.findByText('No reviews yet for this product.')).toBeInTheDocument();
  });

  it('a signed-out visitor sees the empty fallback immediately, not a loading gap', () => {
    renderIt({ emptyFallback: <p>No reviews yet for this product.</p> });
    expect(screen.getByText('No reviews yet for this product.')).toBeInTheDocument();
  });
});
