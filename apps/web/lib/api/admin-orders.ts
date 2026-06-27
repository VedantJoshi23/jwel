import { apiFetch } from './client';
import type { AdminOrder, OrderStatus, PaginatedResult } from './types';

export function adminListOrders(token: string, page = 1, pageSize = 20) {
  return apiFetch<PaginatedResult<AdminOrder>>(`/admin/orders?page=${page}&pageSize=${pageSize}`, {
    token,
    cache: 'no-store',
  });
}

export function adminUpdateOrderStatus(token: string, orderId: string, status: OrderStatus, note?: string) {
  return apiFetch<AdminOrder>(`/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ status, note }),
  });
}
