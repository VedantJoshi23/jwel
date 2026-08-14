'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useAuthStore } from '@/lib/auth-store';
import { adminListUsers, adminSuspendUser, adminUnsuspendUser, type UserStatusFilter } from '@/lib/api/admin-users';
import type { AdminUser } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

export default function AdminCustomersPage() {
  const token = useAuthStore((state) => state.token);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('all');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    adminListUsers(token, 1, 50, statusFilter)
      .then((res) => setUsers(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load customers'));
  }, [token, statusFilter]);

  useEffect(load, [load]);

  async function handleSuspend(userId: string) {
    if (!token) return;
    // A single native dialog does both jobs at once: Cancel aborts (returns
    // null), OK with nothing suspends with no reason, OK with text records
    // it. The reason is what a suspended account owner sees on their next
    // login attempt and what shows up next to them in this list — an admin
    // typing nothing is a deliberate choice, not a missed prompt.
    const reason = window.prompt(
      'Suspend this account? Enter a reason (shown to the user if they try to log in, and to admins in this list) — or leave blank and press OK to suspend without one. Cancel to abort.',
    );
    if (reason === null) return;

    setBusyId(userId);
    setError('');
    try {
      await adminSuspendUser(token, userId, reason);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to suspend user');
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnsuspend(userId: string) {
    if (!token) return;
    setBusyId(userId);
    setError('');
    try {
      await adminUnsuspendUser(token, userId);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to unsuspend user');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Customers</h1>
        <label htmlFor="user-status-filter" className="sr-only">
          Filter customers by status
        </label>
        <Select
          id="user-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as UserStatusFilter)}
          className="h-10 w-auto"
        >
          <option value="all">All customers</option>
          <option value="active">Active only</option>
          <option value="suspended">Suspended only</option>
        </Select>
      </div>

      {error && <p className="mb-4 text-sm text-feedback-error">{error}</p>}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-muted">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{user.name ?? '—'}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={user.role === 'CUSTOMER' ? 'default' : 'accent'}>{user.role}</Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={user.deletedAt ? 'error' : 'success'}>
                      {user.deletedAt ? 'Suspended' : 'Active'}
                    </Badge>
                    {user.deletedAt && user.suspensionReason && (
                      <p className="mt-1 max-w-xs text-xs text-ink-muted">{user.suspensionReason}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.id === currentUserId ? null : user.deletedAt ? (
                      <Button
                        size="s"
                        variant="secondary"
                        loading={busyId === user.id}
                        onClick={() => handleUnsuspend(user.id)}
                      >
                        Unsuspend
                      </Button>
                    ) : (
                      <Button
                        size="s"
                        variant="destructive"
                        loading={busyId === user.id}
                        onClick={() => handleSuspend(user.id)}
                      >
                        Suspend
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-ink-muted">
                    No customers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
