import { apiFetch } from './client';
import type { CouponValidationResult } from './types';

export function validateCoupon(token: string, code: string, subtotalMinorUnits: number) {
  return apiFetch<CouponValidationResult>('/coupons/validate', {
    method: 'POST',
    token,
    body: JSON.stringify({ code, subtotalMinorUnits }),
  });
}
