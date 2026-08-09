import { apiFetch } from './client';

/**
 * Shareable carts — `DOM-SHOPPING` Invariants 9, 11 and 16.
 *
 * The lines are still sent from here rather than read from the sender's cart
 * server-side. That was a necessity when the cart lived in the browser; it is
 * now a choice, and a defensible one — a share is a snapshot of what the
 * sender chose to send, which need not be their whole bag.
 */

export interface CartShareLineInput {
  variantId: string;
  quantity: number;
  giftWrap?: boolean;
  giftNote?: string;
}

export interface SharedCartLine {
  variantId: string;
  quantity: number;
  giftWrap: boolean;
  giftNote: string | null;
  productName: string;
  productSlug: string;
  metal: string;
  size: string | null;
  /** Read when the link is opened, not when it was created (Invariant 11). */
  unitPriceMinorUnits: number;
  /** Also resolved at open time. An unavailable line is shown, not dropped. */
  available: boolean;
}

export function createCartShare(items: CartShareLineInput[]) {
  return apiFetch<{ token: string }>('/cart/shares', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

/** Public — the token is the only credential. */
export function getSharedCart(token: string) {
  return apiFetch<{ items: SharedCartLine[] }>(`/cart/shared/${token}`, { cache: 'no-store' });
}
