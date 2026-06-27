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
