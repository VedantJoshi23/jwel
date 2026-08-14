import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminCustomersPage from './page';
import { useAuthStore } from '@/lib/auth-store';
import { adminListUsers, adminSuspendUser, adminUnsuspendUser } from '@/lib/api/admin-users';
import { ApiError } from '@/lib/api/client';

vi.mock('@/lib/api/admin-users', () => ({
  adminListUsers: vi.fn(),
  adminSuspendUser: vi.fn(),
  adminUnsuspendUser: vi.fn(),
}));

const listUsers = vi.mocked(adminListUsers);
const suspendUser = vi.mocked(adminSuspendUser);
const unsuspendUser = vi.mocked(adminUnsuspendUser);

function user(overrides: Partial<{
  id: string;
  email: string;
  name: string | null;
  role: 'CUSTOMER' | 'ADMIN' | 'STAFF';
  createdAt: string;
  deletedAt: string | null;
  suspensionReason: string | null;
}> = {}) {
  return {
    id: 'u1',
    email: 'customer@example.com',
    name: 'Jane Doe',
    phone: null,
    role: 'CUSTOMER' as const,
    createdAt: '2026-08-01T00:00:00Z',
    deletedAt: null,
    suspensionReason: null,
    ...overrides,
  };
}

describe('AdminCustomersPage', () => {
  beforeEach(() => {
    listUsers.mockReset();
    suspendUser.mockReset();
    unsuspendUser.mockReset();
    listUsers.mockResolvedValue({ items: [], page: 1, pageSize: 50, total: 0 } as never);
    useAuthStore.getState().setSession('token-1', {
      id: 'admin-1',
      email: 'admin@example.com',
      name: null,
      role: 'ADMIN',
    });
  });
  afterEach(() => {
    useAuthStore.getState().logout();
    vi.restoreAllMocks();
  });

  it('lists all customers by default — the actual bug this fixes', async () => {
    // Previously the API hardcoded `deletedAt: null`, so a suspended
    // customer had no path back into this list at all.
    render(<AdminCustomersPage />);
    await waitFor(() => expect(listUsers).toHaveBeenCalledWith('token-1', 1, 50, 'all'));
  });

  it('shows a suspended customer with their reason', async () => {
    listUsers.mockResolvedValue({
      items: [user({ deletedAt: '2026-08-14T00:00:00Z', suspensionReason: 'Fraudulent chargeback' })],
      page: 1,
      pageSize: 50,
      total: 1,
    } as never);
    render(<AdminCustomersPage />);
    expect(await screen.findByText('Suspended')).toBeInTheDocument();
    expect(screen.getByText('Fraudulent chargeback')).toBeInTheDocument();
  });

  it('offers Unsuspend, not Suspend, for a suspended user', async () => {
    listUsers.mockResolvedValue({
      items: [user({ deletedAt: '2026-08-14T00:00:00Z' })],
      page: 1,
      pageSize: 50,
      total: 1,
    } as never);
    render(<AdminCustomersPage />);
    expect(await screen.findByRole('button', { name: 'Unsuspend' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suspend' })).not.toBeInTheDocument();
  });

  it('offers no action for the admin\'s own row', async () => {
    listUsers.mockResolvedValue({
      items: [user({ id: 'admin-1', email: 'admin@example.com' })],
      page: 1,
      pageSize: 50,
      total: 1,
    } as never);
    render(<AdminCustomersPage />);
    await screen.findByText('admin@example.com');
    expect(screen.queryByRole('button', { name: /Suspend|Unsuspend/ })).not.toBeInTheDocument();
  });

  it('changing the status filter re-requests with the new filter', async () => {
    const userEventSession = userEvent.setup();
    render(<AdminCustomersPage />);
    await waitFor(() => expect(listUsers).toHaveBeenCalledWith('token-1', 1, 50, 'all'));

    await userEventSession.selectOptions(
      screen.getByLabelText('Filter customers by status'),
      'suspended',
    );
    await waitFor(() => expect(listUsers).toHaveBeenCalledWith('token-1', 1, 50, 'suspended'));
  });

  it('suspending sends the reason typed into the prompt', async () => {
    listUsers.mockResolvedValue({ items: [user()], page: 1, pageSize: 50, total: 1 } as never);
    suspendUser.mockResolvedValue(undefined as never);
    vi.spyOn(window, 'prompt').mockReturnValue('Fraudulent chargeback');

    const user1 = userEvent.setup();
    render(<AdminCustomersPage />);
    await user1.click(await screen.findByRole('button', { name: 'Suspend' }));

    expect(suspendUser).toHaveBeenCalledWith('token-1', 'u1', 'Fraudulent chargeback');
  });

  it('cancelling the prompt does not suspend anyone', async () => {
    listUsers.mockResolvedValue({ items: [user()], page: 1, pageSize: 50, total: 1 } as never);
    vi.spyOn(window, 'prompt').mockReturnValue(null);

    const user1 = userEvent.setup();
    render(<AdminCustomersPage />);
    await user1.click(await screen.findByRole('button', { name: 'Suspend' }));

    expect(suspendUser).not.toHaveBeenCalled();
  });

  it('suspending with an empty reason still suspends, with no reason', async () => {
    listUsers.mockResolvedValue({ items: [user()], page: 1, pageSize: 50, total: 1 } as never);
    suspendUser.mockResolvedValue(undefined as never);
    vi.spyOn(window, 'prompt').mockReturnValue('');

    const user1 = userEvent.setup();
    render(<AdminCustomersPage />);
    await user1.click(await screen.findByRole('button', { name: 'Suspend' }));

    expect(suspendUser).toHaveBeenCalledWith('token-1', 'u1', '');
  });

  it('unsuspending calls the API for the target user and reloads', async () => {
    listUsers.mockResolvedValue({
      items: [user({ deletedAt: '2026-08-14T00:00:00Z' })],
      page: 1,
      pageSize: 50,
      total: 1,
    } as never);
    unsuspendUser.mockResolvedValue(undefined as never);

    const user1 = userEvent.setup();
    render(<AdminCustomersPage />);
    await user1.click(await screen.findByRole('button', { name: 'Unsuspend' }));

    expect(unsuspendUser).toHaveBeenCalledWith('token-1', 'u1');
  });

  it('surfaces a failed suspend instead of failing silently', async () => {
    listUsers.mockResolvedValue({ items: [user()], page: 1, pageSize: 50, total: 1 } as never);
    suspendUser.mockRejectedValue(new ApiError('Failed to suspend user', 500));
    vi.spyOn(window, 'prompt').mockReturnValue('');

    const user1 = userEvent.setup();
    render(<AdminCustomersPage />);
    await user1.click(await screen.findByRole('button', { name: 'Suspend' }));

    expect(await screen.findByText('Failed to suspend user')).toBeInTheDocument();
  });
});
