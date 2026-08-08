import { apiFetch } from './client';
import type { CustomerReturn, ReturnReason } from './types';

/**
 * The customer side of `DOM-RETURNS`.
 *
 * These endpoints have existed since the returns module was built and **no
 * storefront surface reached them** (KC-117) — while the FAQ told customers to
 * "start a return from your order history". That was one of the claims in
 * `lib/storefront-claims.ts`.
 *
 * There is deliberately **no cancel function here, and none may be added.**
 * `DOM-RETURNS` Invariant 6: a customer may not cancel a pending request and
 * may not re-request after a rejection; exceptions are handled out of band.
 * The API has no cancel endpoint either, so adding one here would only produce
 * a 404 — but the point is that the absence is a rule, not an oversight.
 */

export interface CreateReturnInput {
  orderItemId: string;
  reason: ReturnReason;
  notes?: string;
}

export function createReturn(token: string, input: CreateReturnInput) {
  return apiFetch<CustomerReturn>('/returns', {
    method: 'POST',
    token,
    body: JSON.stringify(input),
  });
}

export function getReturns(token: string) {
  return apiFetch<CustomerReturn[]>('/returns', { token, cache: 'no-store' });
}
