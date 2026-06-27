'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/auth-store';
import { adminListUsers, adminSuspendUser } from '@/lib/api/admin-users';
import type { AdminUser } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

export default function AdminCustomersPage() {
  const token = useAuthStore((state) => state.token);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!token) return;
    adminListUsers(token, 1, 50)
      .then((res) => setUsers(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load customers'));
  }, [token]);

  useEffect(load, [load]);

  async function handleSuspend(userId: string) {
    if (!token) return;
    if (!confirm('Suspend this account? This soft-deletes the user.')) return;
    try {
      await adminSuspendUser(token, userId);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to suspend user');
    }
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-bold">Customers</h1>
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
                  </td>
                  <td className="px-4 py-3">
                    {!user.deletedAt && user.id !== currentUserId && (
                      <Button size="s" variant="destructive" onClick={() => handleSuspend(user.id)}>
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
