import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AskQuestionForm } from './ask-question-form';
import { useAuthStore } from '@/lib/auth-store';
import { askQuestion } from '@/lib/api/qna';
import { ApiError } from '@/lib/api/client';

vi.mock('@/lib/api/qna', () => ({ askQuestion: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ask = vi.mocked(askQuestion);
const toastSuccess = vi.mocked(toast.success);
const toastError = vi.mocked(toast.error);

function renderIt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AskQuestionForm productId="p1" />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

function signIn() {
  useAuthStore.getState().setSession('token-1', { id: 'u1', email: 'a@b.c', name: null, role: 'CUSTOMER' });
}

describe('AskQuestionForm', () => {
  beforeEach(() => {
    ask.mockReset();
    toastSuccess.mockClear();
    toastError.mockClear();
  });
  afterEach(() => useAuthStore.getState().logout());

  it('asks a logged-out visitor to log in rather than showing the form', () => {
    renderIt();
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login?next=/product');
    expect(screen.queryByRole('button', { name: 'Post question' })).not.toBeInTheDocument();
  });

  it('submits a question and confirms with a toast', async () => {
    signIn();
    ask.mockResolvedValue({} as never);
    const user = renderIt();
    await user.type(screen.getByLabelText('Your question'), 'Does this tarnish?');
    await user.click(screen.getByRole('button', { name: 'Post question' }));

    await waitFor(() => expect(ask).toHaveBeenCalledWith('token-1', 'p1', 'Does this tarnish?'));
    expect(toastSuccess).toHaveBeenCalledWith('Question posted');
  });

  it('clears the textarea after a successful post', async () => {
    signIn();
    ask.mockResolvedValue({} as never);
    const user = renderIt();
    const textarea = screen.getByLabelText('Your question') as HTMLTextAreaElement;
    await user.type(textarea, 'Does this tarnish?');
    await user.click(screen.getByRole('button', { name: 'Post question' }));
    await waitFor(() => expect(textarea.value).toBe(''));
  });

  it('shows an ApiError message on failure', async () => {
    signIn();
    ask.mockRejectedValue(new ApiError('Product not found', 404));
    const user = renderIt();
    await user.type(screen.getByLabelText('Your question'), 'Does this tarnish?');
    await user.click(screen.getByRole('button', { name: 'Post question' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Product not found'));
  });

  it('disables submit while the body is empty', () => {
    signIn();
    renderIt();
    expect(screen.getByRole('button', { name: 'Post question' })).toBeDisabled();
  });
});
