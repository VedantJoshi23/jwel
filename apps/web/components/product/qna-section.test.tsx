import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QnaSection } from './qna-section';
import { useAuthStore } from '@/lib/auth-store';
import { getProductQuestions } from '@/lib/api/qna';
import { ApiError } from '@/lib/api/client';
import type { Question } from '@/lib/api/types';

vi.mock('@/lib/api/qna', () => ({
  getProductQuestions: vi.fn(),
  askQuestion: vi.fn(),
  postAnswer: vi.fn(),
  upvoteQuestion: vi.fn(),
  removeQuestionUpvote: vi.fn(),
  upvoteAnswer: vi.fn(),
  removeAnswerUpvote: vi.fn(),
}));

const list = vi.mocked(getProductQuestions);

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    productId: 'p1',
    body: 'Does this tarnish?',
    createdAt: '2026-08-12T00:00:00Z',
    user: { id: 'u1', name: 'Priya' },
    upvoteCount: 2,
    upvotedByMe: false,
    answers: [],
    ...overrides,
  };
}

function renderIt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <QnaSection productId="p1" />
    </QueryClientProvider>,
  );
}

describe('QnaSection', () => {
  beforeEach(() => {
    list.mockReset();
  });
  afterEach(() => useAuthStore.getState().logout());

  it('shows an empty state when there are no questions', async () => {
    list.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
    renderIt();
    expect(await screen.findByText('No questions yet — be the first to ask.')).toBeInTheDocument();
  });

  it('renders a question, its asker, and its answers', async () => {
    list.mockResolvedValue({
      items: [
        makeQuestion({
          answers: [
            {
              id: 'a1',
              questionId: 'q1',
              body: 'Yes, rhodium-plated.',
              createdAt: '2026-08-12T00:00:00Z',
              user: { id: 'u2', name: 'Support' },
              upvoteCount: 1,
              isByStore: false,
            },
          ],
        }),
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    renderIt();
    expect(await screen.findByText('Does this tarnish?')).toBeInTheDocument();
    expect(screen.getByText('Asked by Priya')).toBeInTheDocument();
    expect(screen.getByText(/Yes, rhodium-plated\./)).toBeInTheDocument();
  });

  it('shows the store badge only on an answer with isByStore: true', async () => {
    list.mockResolvedValue({
      items: [
        makeQuestion({
          answers: [
            {
              id: 'a1',
              questionId: 'q1',
              body: 'Official answer.',
              createdAt: '2026-08-12T00:00:00Z',
              user: { id: 'admin1', name: 'Admin' },
              upvoteCount: 0,
              isByStore: true,
            },
          ],
        }),
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    renderIt();
    expect(await screen.findByText('Verified by the store')).toBeInTheDocument();
  });

  it('shows "Anonymous" for a soft-deleted author', async () => {
    list.mockResolvedValue({
      items: [makeQuestion({ user: { id: 'u1', name: null } })],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    renderIt();
    expect(await screen.findByText('Asked by Anonymous')).toBeInTheDocument();
  });

  it('shows an error state rather than misleadingly claiming there are no questions', async () => {
    list.mockRejectedValue(new ApiError('Server error', 500));
    renderIt();
    expect(await screen.findByText('Could not load questions right now.')).toBeInTheDocument();
    expect(screen.queryByText('No questions yet — be the first to ask.')).not.toBeInTheDocument();
  });
});
