import { apiFetch, apiUpload } from './client';
import type { BulkImportResult, Category, CertificationType, MetalType, Product } from './types';
import type { ProductQuery } from './products';

export interface CreateProductVariantInput {
  sku: string;
  metal: MetalType;
  purity?: string;
  size?: string;
  weightGrams: number;
  basePriceMinorUnits: number;
}

export interface CreateProductInput {
  name: string;
  slug: string;
  categoryId: string;
  description: string;
  certificationType?: CertificationType;
  certificationDocRef?: string;
  variants: CreateProductVariantInput[];
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  categoryId?: string;
  status?: Product['status'];
  variantPriceUpdates?: { variantId: string; basePriceMinorUnits: number }[];
}

export function adminListCategories(token: string) {
  return apiFetch<Category[]>('/admin/categories', { token, cache: 'no-store' });
}

export function adminCreateProduct(token: string, input: CreateProductInput) {
  return apiFetch<Product>('/admin/products', {
    method: 'POST',
    token,
    body: JSON.stringify(input),
  });
}

export function adminUpdateProduct(token: string, id: string, input: UpdateProductInput) {
  return apiFetch<Product>(`/admin/products/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(input),
  });
}

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
