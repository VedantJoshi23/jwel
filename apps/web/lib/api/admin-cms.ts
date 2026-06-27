import { apiFetch } from './client';
import type { Banner } from './types';

export function adminListBanners(token: string) {
  return apiFetch<Banner[]>('/admin/cms/banners', { token, cache: 'no-store' });
}

export interface UpsertBannerInput {
  title: string;
  imageRef: string;
  linkUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
  startsAt?: string;
  endsAt?: string;
}

export function adminCreateBanner(token: string, input: UpsertBannerInput) {
  return apiFetch<Banner>('/admin/cms/banners', { method: 'POST', token, body: JSON.stringify(input) });
}

export function adminUpdateBanner(token: string, id: string, input: UpsertBannerInput) {
  return apiFetch<Banner>(`/admin/cms/banners/${id}`, { method: 'PUT', token, body: JSON.stringify(input) });
}

export function adminDeleteBanner(token: string, id: string) {
  return apiFetch<void>(`/admin/cms/banners/${id}`, { method: 'DELETE', token });
}
