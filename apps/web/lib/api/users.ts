import { apiFetch } from './client';
import type { Address, UserProfile } from './types';

export function getProfile(token: string) {
  return apiFetch<UserProfile>('/me', { token, cache: 'no-store' });
}

export function updateProfile(token: string, data: { name?: string; phone?: string }) {
  return apiFetch<UserProfile>('/me', { method: 'PATCH', token, body: JSON.stringify(data) });
}

export function listAddresses(token: string) {
  return apiFetch<Address[]>('/me/addresses', { token, cache: 'no-store' });
}

export function addAddress(token: string, data: Omit<Address, 'id'>) {
  return apiFetch<Address>('/me/addresses', { method: 'POST', token, body: JSON.stringify(data) });
}

export function removeAddress(token: string, addressId: string) {
  return apiFetch<void>(`/me/addresses/${addressId}`, { method: 'DELETE', token });
}
