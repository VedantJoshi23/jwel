import { apiFetch } from './client';
import type { AdminReturn, ReturnStatus } from './types';

// Unlike adminListOrders, the API returns a bare array here, not a
// PaginatedResult — ReturnsService.adminFindAll (apps/api) does too, so this
// mirrors the actual response shape rather than assuming parity with orders.
export function adminListReturns(token: string, status?: ReturnStatus) {
  const query = status ? `?status=${status}` : '';
  return apiFetch<AdminReturn[]>(`/admin/returns${query}`, { token, cache: 'no-store' });
}

export function adminUpdateReturnStatus(
  token: string,
  returnId: string,
  status: ReturnStatus,
  refundAmountMinorUnits?: number,
) {
  return apiFetch<AdminReturn>(`/admin/returns/${returnId}/status`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ status, refundAmountMinorUnits }),
  });
}
