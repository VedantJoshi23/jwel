import { apiFetch, apiUpload } from './client';
import type { BulkImportResult, Product } from './types';
import type { ProductQuery } from './products';

export function adminListProducts(token: string, query: ProductQuery & { page?: number; pageSize?: number } = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return apiFetch<{ items: Product[]; page: number; pageSize: number; total: number }>(
    `/admin/products${qs ? `?${qs}` : ''}`,
    { token, cache: 'no-store' },
  );
}

export function adminGetProduct(token: string, id: string) {
  return apiFetch<Product>(`/admin/products/${id}`, { token, cache: 'no-store' });
}

export function adminUpdateProductStatus(token: string, id: string, status: Product['status']) {
  return apiFetch<Product>(`/admin/products/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ status }),
  });
}

export function bulkImportProducts(token: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload<BulkImportResult>('/admin/products/bulk-import', formData, token);
}

export function adminUploadProductMedia(token: string, productId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload<Product>(`/admin/products/${productId}/media`, formData, token);
}

export function adminRemoveProductMedia(token: string, productId: string, mediaId: string) {
  return apiFetch<Product>(`/admin/products/${productId}/media/${mediaId}`, { method: 'DELETE', token });
}

export function adminReorderProductMedia(token: string, productId: string, mediaIds: string[]) {
  return apiFetch<Product>(`/admin/products/${productId}/media/reorder`, {
    method: 'PUT',
    token,
    body: JSON.stringify({ mediaIds }),
  });
}
