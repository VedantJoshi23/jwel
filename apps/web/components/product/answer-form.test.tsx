import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AnswerForm } from './answer-form';
import { useAuthStore } from '@/lib/auth-store';
import { postAnswer } from '@/lib/api/qna';
import { ApiError } from '@/lib/api/client';

vi.mock('@/lib/api/qna', () => ({ postAnswer: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const answer = vi.mocked(postAnswer);
const toastSuccess = vi.mocked(toast.success);
const toastError = vi.mocked(toast.error);

function renderIt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AnswerForm questionId="q1" productId="p1" />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

function signIn() {
  useAuthStore.getState().setSession('token-1', { id: 'u1', email: 'a@b.c', name: null, role: 'CUSTOMER' });
}

describe('AnswerForm', () => {
  beforeEach(() => {
    answer.mockReset();
    toastSuccess.mockClear();
    toastError.mockClear();
  });
  afterEach(() => useAuthStore.getState().logout());

  it('asks a logged-out visitor to log in rather than showing a toggle', () => {
    renderIt();
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login?next=/product');
    expect(screen.queryByRole('button', { name: 'Answer' })).not.toBeInTheDocument();
  });

  it('is collapsed behind an "Answer" toggle until clicked', () => {
    signIn();
    renderIt();
    expect(screen.getByRole('button', { name: 'Answer' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Your answer')).not.toBeInTheDocument();
  });

  it('opens the form, submits, and confirms with a toast', async () => {
    signIn();
    answer.mockResolvedValue({} as never);
    const user = renderIt();
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    await user.type(screen.getByLabelText('Your answer'), 'It is 3mm.');
    await user.click(screen.getByRole('button', { name: 'Post answer' }));

    await waitFor(() => expect(answer).toHaveBeenCalledWith('token-1', 'q1', 'It is 3mm.'));
    expect(toastSuccess).toHaveBeenCalledWith('Answer posted');
  });

  it('collapses back to the toggle after a successful submit', async () => {
    signIn();
    answer.mockResolvedValue({} as never);
    const user = renderIt();
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    await user.type(screen.getByLabelText('Your answer'), 'It is 3mm.');
    await user.click(screen.getByRole('button', { name: 'Post answer' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Answer' })).toBeInTheDocument());
  });

  it('cancel collapses the form without submitting', async () => {
    signIn();
    const user = renderIt();
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    await user.type(screen.getByLabelText('Your answer'), 'draft');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Answer' })).toBeInTheDocument();
    expect(answer).not.toHaveBeenCalled();
  });

  it('shows an ApiError message on failure', async () => {
    signIn();
    answer.mockRejectedValue(new ApiError('Question not found', 404));
    const user = renderIt();
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    await user.type(screen.getByLabelText('Your answer'), 'It is 3mm.');
    await user.click(screen.getByRole('button', { name: 'Post answer' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Question not found'));
  });
});
