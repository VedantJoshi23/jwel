import { apiFetch } from './client';
import type { InventoryItem } from './types';

export function listLowStock(token: string) {
  return apiFetch<InventoryItem[]>('/admin/inventory/low-stock', { token, cache: 'no-store' });
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
