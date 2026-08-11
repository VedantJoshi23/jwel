import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ReviewForm } from './review-form';
import { useAuthStore } from '@/lib/auth-store';
import { createReview, getMyReview } from '@/lib/api/products';
import { ApiError } from '@/lib/api/client';

vi.mock('@/lib/api/products', () => ({ createReview: vi.fn(), getMyReview: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const create = vi.mocked(createReview);
const getMine = vi.mocked(getMyReview);
const toastSuccess = vi.mocked(toast.success);
const toastError = vi.mocked(toast.error);

function renderIt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ReviewForm productId="p1" />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

function signIn() {
  useAuthStore.getState().setSession('token-1', { id: 'u1', email: 'a@b.c', name: null, role: 'CUSTOMER' });
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('radio', { name: '4 stars' }));
  await user.type(screen.getByLabelText('Your review'), 'Beautiful craftsmanship.');
  await user.click(screen.getByRole('button', { name: 'Submit review' }));
}

describe('ReviewForm', () => {
  beforeEach(() => {
    create.mockReset();
    getMine.mockReset();
    toastSuccess.mockClear();
    toastError.mockClear();
    getMine.mockResolvedValue(null);
  });
  afterEach(() => useAuthStore.getState().logout());

  it('asks a logged-out visitor to log in rather than showing the form', () => {
    renderIt();
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login?next=/product');
    expect(screen.queryByRole('button', { name: 'Submit review' })).not.toBeInTheDocument();
  });

  it('shows the form once it confirms the visitor has not already reviewed this product', async () => {
    signIn();
    renderIt();
    expect(await screen.findByRole('button', { name: 'Submit review' })).toBeInTheDocument();
  });

  it('renders nothing once a review is found — that is MyReviewStatus\'s surface, not this one\'s', async () => {
    signIn();
    getMine.mockResolvedValue({ id: 'r1', moderationStatus: 'PENDING' } as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={client}>
        <ReviewForm productId="p1" />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(getMine).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('submits, confirms with a toast, and invalidates so the pending status appears without a reload', async () => {
    signIn();
    create.mockResolvedValue({} as never);
    const user = renderIt();
    await fillAndSubmit(user);

    await waitFor(() => expect(create).toHaveBeenCalledWith('token-1', {
      productId: 'p1',
      rating: 4,
      title: undefined,
      body: 'Beautiful craftsmanship.',
    }));
    expect(toastSuccess).toHaveBeenCalledWith('Review submitted', expect.any(Object));
    // getMyReview is invalidated (refetched) after a successful submit — the
    // second call proves the cache was actually invalidated, not just that
    // the mutation resolved.
    await waitFor(() => expect(getMine).toHaveBeenCalledTimes(2));
  });

  it('shows a specific message for a duplicate submission and hides the form rather than inviting a retry', async () => {
    signIn();
    create.mockRejectedValue(new ApiError('Conflict', 409));
    const user = renderIt();
    await fillAndSubmit(user);

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('You have already reviewed this product.'),
    );
    // The 409 path re-validates against the server rather than trusting the
    // stale "no review yet" cache that led to the doomed submit attempt.
    await waitFor(() => expect(getMine).toHaveBeenCalledTimes(2));
  });

  it('shows a generic message for a non-ApiError failure', async () => {
    signIn();
    create.mockRejectedValue(new Error('network down'));
    const user = renderIt();
    await fillAndSubmit(user);

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Something went wrong submitting your review.'),
    );
  });
});
