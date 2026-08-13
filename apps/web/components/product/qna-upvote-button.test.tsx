import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QnaUpvoteButton } from './qna-upvote-button';
import { useAuthStore } from '@/lib/auth-store';
import { removeAnswerUpvote, removeQuestionUpvote, upvoteAnswer, upvoteQuestion } from '@/lib/api/qna';

vi.mock('@/lib/api/qna', () => ({
  upvoteQuestion: vi.fn(),
  removeQuestionUpvote: vi.fn(),
  upvoteAnswer: vi.fn(),
  removeAnswerUpvote: vi.fn(),
}));

const upQ = vi.mocked(upvoteQuestion);
const downQ = vi.mocked(removeQuestionUpvote);
const upA = vi.mocked(upvoteAnswer);
const downA = vi.mocked(removeAnswerUpvote);

function renderIt(props: Partial<React.ComponentProps<typeof QnaUpvoteButton>> = {}, client?: QueryClient) {
  const queryClient = client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <QnaUpvoteButton id="q1" kind="question" productId="p1" count={3} {...props} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

function signIn() {
  useAuthStore.getState().setSession('token-1', { id: 'u1', email: 'a@b.c', name: null, role: 'CUSTOMER' });
}

describe('QnaUpvoteButton', () => {
  beforeEach(() => {
    upQ.mockReset();
    downQ.mockReset();
    upA.mockReset();
    downA.mockReset();
    upQ.mockResolvedValue(undefined as never);
    downQ.mockResolvedValue(undefined as never);
    upA.mockResolvedValue(undefined as never);
    downA.mockResolvedValue(undefined as never);
  });
  afterEach(() => useAuthStore.getState().logout());

  it('renders a read-only count for a logged-out visitor, no button', () => {
    renderIt();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('casts an upvote on a question when not already upvoted', async () => {
    signIn();
    const user = renderIt({ upvoted: false });
    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(upQ).toHaveBeenCalledWith('token-1', 'q1'));
    expect(downQ).not.toHaveBeenCalled();
  });

  it('removes the upvote on a second press, and aria-pressed reflects the current state', async () => {
    signIn();
    const user = renderIt({ upvoted: true });
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    await user.click(button);
    await waitFor(() => expect(downQ).toHaveBeenCalledWith('token-1', 'q1'));
    expect(upQ).not.toHaveBeenCalled();
  });

  it('targets the answer endpoints when kind is "answer"', async () => {
    signIn();
    const user = renderIt({ id: 'a1', kind: 'answer', upvoted: false });
    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(upA).toHaveBeenCalledWith('token-1', 'a1'));
  });

  it('states the count and votes in the accessible name, not colour/icon alone', () => {
    signIn();
    renderIt({ upvoted: false, count: 5 });
    expect(screen.getByRole('button', { name: /Upvote this question — 5 votes/ })).toBeInTheDocument();
  });

  it('writes the flip into the shared query cache immediately, not just after a refetch', async () => {
    // Regression for a real production bug: without an optimistic write, a
    // second click landing in the gap between "mutation settled" and "the
    // invalidated refetch actually resolved" read the stale `upvoted` prop
    // and sent a second, now-wrong-direction request that 404'd — a
    // successful upvote followed almost immediately by a failing "you
    // haven't upvoted this" toast. Asserting the cache is correct
    // synchronously after the mutation settles is what proves that gap is
    // closed, independent of how fast the network refetch happens to be.
    signIn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const queryKey = ['questions', 'p1', true];
    client.setQueryData(queryKey, {
      items: [{ id: 'q1', productId: 'p1', body: 'Q', createdAt: '', user: { id: 'u2', name: null }, upvoteCount: 3, upvotedByMe: false, answers: [] }],
      page: 1,
      pageSize: 20,
      total: 1,
    });

    const user = renderIt({ upvoted: false, count: 3 }, client);
    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(upQ).toHaveBeenCalled());

    const cached = client.getQueryData<{ items: { upvoteCount: number; upvotedByMe?: boolean }[] }>(queryKey);
    expect(cached?.items[0]).toMatchObject({ upvoteCount: 4, upvotedByMe: true });
  });
});
