import { apiFetch } from './client';
import type { Coupon, DiscountType } from './types';

export function adminListCoupons(token: string) {
  return apiFetch<Coupon[]>('/admin/coupons', { token, cache: 'no-store' });
}

export interface CreateCouponInput {
  code: string;
  discountType: DiscountType;
  value: number;
  minOrderAmountMinorUnits?: number;
  maxRedemptions?: number;
  maxRedemptionsPerUser?: number;
  validFrom: string;
  validTo: string;
}

export function adminCreateCoupon(token: string, input: CreateCouponInput) {
  return apiFetch<Coupon>('/admin/coupons', { method: 'POST', token, body: JSON.stringify(input) });
}

export function adminDeactivateCoupon(token: string, id: string) {
  return apiFetch<Coupon>(`/admin/coupons/${id}/deactivate`, { method: 'PATCH', token });
}

/**
 * Soft-delete — hides the coupon from `adminListCoupons` while keeping its
 * redemption history intact. Always safe, regardless of whether the coupon
 * has ever been redeemed.
 */
export function adminArchiveCoupon(token: string, id: string) {
  return apiFetch<Coupon>(`/admin/coupons/${id}/archive`, { method: 'PATCH', token });
}

/**
 * A real, irreversible delete. The API refuses this (400, with a message
 * naming the redemption count) once the coupon has ever been redeemed —
 * `adminArchiveCoupon` is the option for that case, not a fallback this
 * function needs to handle itself.
 */
export function adminHardDeleteCoupon(token: string, id: string) {
  return apiFetch<void>(`/admin/coupons/${id}`, { method: 'DELETE', token });
}
