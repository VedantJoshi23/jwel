import { apiFetch } from './client';
import type { Category, SizeScheme } from './types';

export interface CreateCategoryInput {
  name: string;
  slug?: string;
  parentId?: string | null;
  sortOrder?: number;
}

export type UpdateCategoryInput = Partial<CreateCategoryInput> & {
  /** `null` reverts to "inherit from parent"; omit to leave untouched. */
  sizeScheme?: SizeScheme | null;
};

export function adminCreateCategory(token: string, input: CreateCategoryInput) {
  return apiFetch<Category>('/admin/categories', {
    method: 'POST',
    token,
    body: JSON.stringify(input),
  });
}

export function adminUpdateCategory(token: string, id: string, input: UpdateCategoryInput) {
  return apiFetch<Category>(`/admin/categories/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(input),
  });
}

export function adminDeleteCategory(token: string, id: string) {
  return apiFetch<void>(`/admin/categories/${id}`, { method: 'DELETE', token });
}
