import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './page';
import { login } from '@/lib/api/auth';

let searchParams = new URLSearchParams();
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ push, replace: vi.fn() }),
}));
vi.mock('@/lib/api/auth', () => ({ login: vi.fn() }));

describe('LoginPage — session expiry', () => {
  it('shows no message under an ordinary visit', () => {
    searchParams = new URLSearchParams();
    render(<LoginPage />);
    expect(screen.queryByText(/session ended/i)).not.toBeInTheDocument();
  });

  it('shows a plain-language message when redirected here by an expired session', () => {
    searchParams = new URLSearchParams({ sessionExpired: '1' });
    render(<LoginPage />);
    expect(screen.getByText(/Your session ended\. Log in again to continue\./)).toBeInTheDocument();
  });
});

describe('LoginPage — where it sends you afterwards', () => {
  beforeEach(() => {
    push.mockReset();
    vi.mocked(login).mockResolvedValue({
      accessToken: 't',
      user: { id: 'u1', email: 'a@b.c', name: null, role: 'CUSTOMER' },
    } as never);
  });

  async function logIn(next?: string) {
    searchParams = new URLSearchParams(next === undefined ? {} : { next });
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText('Email'), 'a@b.c');
    await user.type(screen.getByLabelText('Password'), 'secret-password');
    await user.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    return push.mock.calls[0][0];
  }

  it('returns you to the page you came from', async () => {
    expect(await logIn('/product/diamond-halo-ring')).toBe('/product/diamond-halo-ring');
  });

  it('goes to your profile when there is nowhere to return to', async () => {
    expect(await logIn()).toBe('/profile');
  });

  it.each([
    'https://phishing.example/login',
    '//phishing.example',
    'javascript:alert(document.cookie)',
  ])('refuses to send a freshly logged-in customer to %s', async (next) => {
    // Regression: `next` was pushed raw, and Next's router performs a full
    // browser navigation for a cross-origin target — an open redirect.
    expect(await logIn(next)).toBe('/profile');
  });
});
