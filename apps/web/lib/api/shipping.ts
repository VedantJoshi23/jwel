import { apiFetch } from './client';
import type { PaginatedResult, PincodeOverride, ServiceabilityResult } from './types';

/**
 * `FEAT-DELIVERY-ESTIMATE` (`ADR-0024`) — an interim, admin-managed
 * deliverability estimate. Not a live carrier check; see `source` on the
 * result, always `'ESTIMATED'` from this provider today.
 */

export function checkServiceability(pincode: string): Promise<ServiceabilityResult> {
  return apiFetch<ServiceabilityResult>(`/shipping/serviceability?pincode=${encodeURIComponent(pincode)}`, {
    cache: 'no-store',
  });
}

export interface UpsertPincodeOverrideInput {
  pincode?: string;
  deliverable?: boolean;
  estimatedMinDays?: number;
  estimatedMaxDays?: number;
  note?: string;
}

export function adminListPincodeOverrides(
  token: string,
  page = 1,
  pageSize = 50,
): Promise<PaginatedResult<PincodeOverride>> {
  return apiFetch<PaginatedResult<PincodeOverride>>(
    `/admin/shipping/pincode-overrides?page=${page}&pageSize=${pageSize}`,
    { token, cache: 'no-store' },
  );
}

export function adminCreatePincodeOverride(
  token: string,
  input: UpsertPincodeOverrideInput,
): Promise<PincodeOverride> {
  return apiFetch<PincodeOverride>('/admin/shipping/pincode-overrides', {
    method: 'POST',
    token,
    body: JSON.stringify(input),
  });
}

export function adminUpdatePincodeOverride(
  token: string,
  id: string,
  input: UpsertPincodeOverrideInput,
): Promise<PincodeOverride> {
  return apiFetch<PincodeOverride>(`/admin/shipping/pincode-overrides/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(input),
  });
}

export function adminDeletePincodeOverride(token: string, id: string): Promise<void> {
  return apiFetch<void>(`/admin/shipping/pincode-overrides/${id}`, {
    method: 'DELETE',
    token,
  });
}
