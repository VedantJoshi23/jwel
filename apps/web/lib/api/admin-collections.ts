import { apiFetch } from './client';
import type { AdminCollection, Collection, CollectionType } from './types';

export interface UpsertCollectionInput {
  name: string;
  slug?: string;
  type: CollectionType;
  description?: string;
  heroImageRef?: string;
  isFeatured?: boolean;
  startsAt?: string;
  endsAt?: string;
  /** Full membership list. Replaces contents when present; omit to leave unchanged. */
  productIds?: string[];
}

export function adminListCollections(token: string) {
  return apiFetch<AdminCollection[]>('/admin/collections', { token, cache: 'no-store' });
}

export function adminCreateCollection(token: string, input: UpsertCollectionInput) {
  return apiFetch<Collection>('/admin/collections', {
    method: 'POST',
    token,
    body: JSON.stringify(input),
  });
}

export function adminUpdateCollection(token: string, id: string, input: UpsertCollectionInput) {
  return apiFetch<Collection>(`/admin/collections/${id}`, {
    method: 'PUT',
    token,
    body: JSON.stringify(input),
  });
}

export function adminDeleteCollection(token: string, id: string) {
  return apiFetch<void>(`/admin/collections/${id}`, { method: 'DELETE', token });
}
