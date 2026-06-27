import { apiFetch } from './client';
import type { AdminUser, PaginatedResult } from './types';

export function adminListUsers(token: string, page = 1, pageSize = 20) {
  return apiFetch<PaginatedResult<AdminUser>>(`/admin/users?page=${page}&pageSize=${pageSize}`, {
    token,
    cache: 'no-store',
  });
}

export function adminSuspendUser(token: string, userId: string) {
  return apiFetch<void>(`/admin/users/${userId}/suspend`, { method: 'PATCH', token });
}
