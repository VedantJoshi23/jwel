import { apiFetch } from './client';

export interface VerifyPaymentInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

/**
 * Hands the Checkout modal's result back for server-side signature
 * verification.
 *
 * Deliberately unauthenticated: the signature *is* the credential, and the API
 * treats this as a convenience path only — the signed webhook confirms the
 * same payment if this never lands. See payments.controller.ts.
 */
export function verifyPayment(input: VerifyPaymentInput) {
  return apiFetch<{ verified: true }>('/payments/verify', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
