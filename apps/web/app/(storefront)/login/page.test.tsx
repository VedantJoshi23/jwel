import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoginPage from './page';

let searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

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
