import { apiFetch } from './client';
import type { AdminUser, PaginatedResult } from './types';

export type UserStatusFilter = 'active' | 'suspended' | 'all';

// Defaults to 'all' — a suspended user was previously unreachable from this
// list no matter what, since the API hardcoded `deletedAt: null`. Matching
// that default here (rather than defaulting to 'active' and requiring the
// admin to know a filter exists) is what makes the fix visible by default.
export function adminListUsers(
  token: string,
  page = 1,
  pageSize = 20,
  status: UserStatusFilter = 'all',
) {
  return apiFetch<PaginatedResult<AdminUser>>(
    `/admin/users?page=${page}&pageSize=${pageSize}&status=${status}`,
    { token, cache: 'no-store' },
  );
}

export function adminSuspendUser(token: string, userId: string, reason?: string) {
  return apiFetch<void>(`/admin/users/${userId}/suspend`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ reason: reason || undefined }),
  });
}

export function adminUnsuspendUser(token: string, userId: string) {
  return apiFetch<void>(`/admin/users/${userId}/unsuspend`, { method: 'PATCH', token });
}
