import { apiFetch } from './client';

/**
 * Shareable carts — `DOM-SHOPPING` Invariants 9, 11 and 16.
 *
 * The lines are sent from here because the cart lives in this browser
 * (`lib/cart-store`), not on the server. Sharing a server cart the storefront
 * does not use would share an empty one.
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
