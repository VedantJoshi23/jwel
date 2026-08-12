import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AdminLayout from './layout';
import { useAuthStore } from '@/lib/auth-store';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ replace }),
}));

describe('AdminLayout — logout', () => {
  beforeEach(() => {
    replace.mockClear();
    useAuthStore.getState().setSession('token-1', {
      id: 'admin1',
      email: 'admin@example.com',
      name: null,
      role: 'ADMIN',
    });
  });
  afterEach(() => useAuthStore.getState().logout());

  it('renders a visible "Log out" control in the sidebar', () => {
    render(
      <AdminLayout>
        <p>page content</p>
      </AdminLayout>,
    );
    expect(screen.getByRole('button', { name: /Log out/ })).toBeInTheDocument();
  });

  it('clicking it clears the session — the previously missing way out of a stuck admin session', () => {
    render(
      <AdminLayout>
        <p>page content</p>
      </AdminLayout>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Log out/ }));
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('AdminGuard reacts to the cleared session and redirects to /login on its own', () => {
    render(
      <AdminLayout>
        <p>page content</p>
      </AdminLayout>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Log out/ }));
    expect(replace).toHaveBeenCalledWith('/login?next=/admin');
  });
});
