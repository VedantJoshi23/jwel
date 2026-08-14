import { apiFetch } from './client';
import type { AdminInventoryItem, InventoryItem, PaginatedResult } from './types';

// Local, matching qna.ts's own (file-local, non-exported) convention rather
// than introducing a new shared util.
function toQueryString<T extends object>(query: T): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query as Record<string, string | number | boolean | undefined>)) {
    if (value !== undefined && value !== '' && value !== false) {
      params.set(key, String(value));
    }
  }
  const str = params.toString();
  return str ? `?${str}` : '';
}

export function listLowStock(token: string) {
  return apiFetch<InventoryItem[]>('/admin/inventory/low-stock', { token, cache: 'no-store' });
}

/**
 * The general-purpose, searchable counterpart to `listLowStock` — a variant
 * that has already been restocked above its threshold is otherwise
 * unreachable from the admin UI, which was the actual bug this fixes.
 */
export function listInventory(
  token: string,
  query: { page?: number; pageSize?: number; q?: string; lowStockOnly?: boolean } = {},
) {
  return apiFetch<PaginatedResult<AdminInventoryItem>>(`/admin/inventory${toQueryString(query)}`, {
    token,
    cache: 'no-store',
  });
}

export function getInventory(token: string, variantId: string) {
  return apiFetch<InventoryItem>(`/admin/inventory/${variantId}`, { token, cache: 'no-store' });
}

export function adjustStock(token: string, variantId: string, delta: number) {
  return apiFetch<InventoryItem>(`/admin/inventory/${variantId}/adjust`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ delta }),
  });
}
