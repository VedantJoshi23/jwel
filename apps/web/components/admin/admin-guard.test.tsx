import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminGuard } from './admin-guard';
import { useAuthStore } from '@/lib/auth-store';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

describe('AdminGuard', () => {
  beforeEach(() => {
    replace.mockClear();
    useAuthStore.getState().logout();
  });
  afterEach(() => {
    useAuthStore.getState().logout();
  });

  it('redirects to login when there is no session', () => {
    render(
      <AdminGuard>
        <p>secret admin content</p>
      </AdminGuard>,
    );
    expect(replace).toHaveBeenCalledWith('/login?next=/admin');
    expect(screen.queryByText('secret admin content')).not.toBeInTheDocument();
  });

  it('shows a "Checking access…" fallback instead of children while unauthenticated', () => {
    render(
      <AdminGuard>
        <p>secret admin content</p>
      </AdminGuard>,
    );
    expect(screen.getByText('Checking access…')).toBeInTheDocument();
  });

  it('redirects to home for a logged-in CUSTOMER (not an admin role)', () => {
    useAuthStore.getState().setSession('token', { id: 'u1', email: 'a@b.com', name: null, role: 'CUSTOMER' });
    render(
      <AdminGuard>
        <p>secret admin content</p>
      </AdminGuard>,
    );
    expect(replace).toHaveBeenCalledWith('/');
    expect(screen.queryByText('secret admin content')).not.toBeInTheDocument();
  });

  it('renders children for a logged-in ADMIN', () => {
    useAuthStore.getState().setSession('token', { id: 'u1', email: 'a@b.com', name: null, role: 'ADMIN' });
    render(
      <AdminGuard>
        <p>secret admin content</p>
      </AdminGuard>,
    );
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText('secret admin content')).toBeInTheDocument();
  });

  it('renders children for a logged-in STAFF user', () => {
    useAuthStore.getState().setSession('token', { id: 'u1', email: 'a@b.com', name: null, role: 'STAFF' });
    render(
      <AdminGuard>
        <p>secret admin content</p>
      </AdminGuard>,
    );
    expect(screen.getByText('secret admin content')).toBeInTheDocument();
  });
});
