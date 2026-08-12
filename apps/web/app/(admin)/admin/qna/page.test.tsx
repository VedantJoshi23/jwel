import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminQnaPage from './page';
import { useAuthStore } from '@/lib/auth-store';
import { adminListQuestions, adminModerateAnswer, adminModerateQuestion, adminPostAnswer } from '@/lib/api/admin-qna';
import type { AdminQuestion } from '@/lib/api/types';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/admin/qna',
}));

vi.mock('@/lib/api/admin-qna', () => ({
  adminListQuestions: vi.fn(),
  adminModerateQuestion: vi.fn(),
  adminModerateAnswer: vi.fn(),
  adminPostAnswer: vi.fn(),
}));

const listQuestions = vi.mocked(adminListQuestions);
const moderateQuestion = vi.mocked(adminModerateQuestion);
const moderateAnswer = vi.mocked(adminModerateAnswer);
const postAnswer = vi.mocked(adminPostAnswer);

function makeQuestion(overrides: Partial<AdminQuestion> = {}): AdminQuestion {
  return {
    id: 'q1',
    productId: 'p1',
    body: 'Does this tarnish?',
    createdAt: '2026-08-12T00:00:00Z',
    user: { id: 'u1', name: 'Priya', email: 'priya@example.com' },
    upvoteCount: 2,
    isHidden: false,
    product: { id: 'p1', name: 'Diamond Halo Ring', slug: 'diamond-halo-ring', image: null },
    answers: [],
    ...overrides,
  };
}

describe('AdminQnaPage', () => {
  beforeEach(() => {
    listQuestions.mockReset();
    moderateQuestion.mockReset();
    moderateAnswer.mockReset();
    postAnswer.mockReset();
    listQuestions.mockResolvedValue({ items: [makeQuestion()], page: 1, pageSize: 20, total: 1 });
    useAuthStore.getState().setSession('token-1', {
      id: 'admin1',
      email: 'admin@example.com',
      name: null,
      role: 'ADMIN',
    });
  });
  afterEach(() => useAuthStore.getState().logout());

  it('renders the product name, image link, and question body — admin context to answer responsibly', async () => {
    render(<AdminQnaPage />);
    expect(await screen.findByText('Diamond Halo Ring')).toBeInTheDocument();
    expect(screen.getByText('Does this tarnish?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Diamond Halo Ring' })).toHaveAttribute(
      'href',
      '/product/diamond-halo-ring',
    );
  });

  it('loads all questions by default, not just unanswered ones', async () => {
    render(<AdminQnaPage />);
    await screen.findByText('Diamond Halo Ring');
    expect(listQuestions).toHaveBeenCalledWith('token-1', false, 1, 20);
  });

  it('toggling the unanswered filter passes unanswered: true', async () => {
    render(<AdminQnaPage />);
    await screen.findByText('Diamond Halo Ring');
    fireEvent.change(screen.getByLabelText('Filter to unanswered questions'), {
      target: { value: 'unanswered' },
    });
    await waitFor(() => expect(listQuestions).toHaveBeenLastCalledWith('token-1', true, 1, 20));
  });

  it('hiding a question calls moderate with the opposite of its current state, then reloads', async () => {
    moderateQuestion.mockResolvedValue({} as never);
    render(<AdminQnaPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Hide question' }));
    await waitFor(() => expect(moderateQuestion).toHaveBeenCalledWith('token-1', 'q1', true));
    await waitFor(() => expect(listQuestions).toHaveBeenCalledTimes(2));
  });

  it('unhiding an already-hidden question sends hidden: false', async () => {
    listQuestions.mockResolvedValue({ items: [makeQuestion({ isHidden: true })], page: 1, pageSize: 20, total: 1 });
    moderateQuestion.mockResolvedValue({} as never);
    render(<AdminQnaPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Unhide question' }));
    await waitFor(() => expect(moderateQuestion).toHaveBeenCalledWith('token-1', 'q1', false));
  });

  it('hiding a single answer calls the answer moderate route with the answer id, not the question', async () => {
    listQuestions.mockResolvedValue({
      items: [
        makeQuestion({
          answers: [
            {
              id: 'a1',
              questionId: 'q1',
              body: 'Yes.',
              createdAt: '2026-08-12T00:00:00Z',
              user: { id: 'u2', name: 'Store', email: 'store@example.com' },
              upvoteCount: 0,
              isByStore: true,
              isHidden: false,
            },
          ],
        }),
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    moderateAnswer.mockResolvedValue(undefined as never);
    render(<AdminQnaPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Hide answer' }));
    await waitFor(() => expect(moderateAnswer).toHaveBeenCalledWith('token-1', 'a1', true));
  });

  it('posting an inline answer calls adminPostAnswer with the typed body and clears the draft', async () => {
    postAnswer.mockResolvedValue(undefined as never);
    render(<AdminQnaPage />);
    const textarea = await screen.findByLabelText('Write an answer');
    fireEvent.change(textarea, { target: { value: 'It is 3mm.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));

    await waitFor(() => expect(postAnswer).toHaveBeenCalledWith('token-1', 'q1', 'It is 3mm.'));
    await waitFor(() => expect((textarea as HTMLTextAreaElement).value).toBe(''));
  });

  it('shows an inline error rather than the row silently vanishing on a failed moderation call', async () => {
    moderateQuestion.mockRejectedValue(new Error('boom'));
    render(<AdminQnaPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Hide question' }));
    expect(await screen.findByText('Failed to update the question')).toBeInTheDocument();
    expect(await screen.findByText('Does this tarnish?')).toBeInTheDocument();
  });

  it('shows an empty state when there are no questions', async () => {
    listQuestions.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
    render(<AdminQnaPage />);
    expect(await screen.findByText('No questions.')).toBeInTheDocument();
  });

  it('the empty state names the active filter when scoped to unanswered', async () => {
    listQuestions.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
    render(<AdminQnaPage />);
    await screen.findByText('No questions.');
    fireEvent.change(screen.getByLabelText('Filter to unanswered questions'), {
      target: { value: 'unanswered' },
    });
    expect(await screen.findByText('No unanswered questions.')).toBeInTheDocument();
  });
});
