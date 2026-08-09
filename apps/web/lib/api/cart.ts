import { apiFetch } from './client';
import type { ServerCart, CartClaimResult } from './types';
import { ensureGuestCartToken, getGuestCartToken } from '../guest-cart-token';

/**
 * The server-side cart — `DOM-SHOPPING`.
 *
 * Identity is resolved by the API: a bearer token means the account's cart, an
 * `x-guest-cart-token` header means that guest's. A request carrying both uses
 * the account, so this never has to decide which one wins.
 *
 * Reads use the token only if the browser already has one — a visitor who has
 * never added anything should not cause a cart row to exist just by opening
 * the cart page. Writes create one.
 */
function identityHeaders(token: string | null, createGuestToken = false): Record<string, string> {
  if (token) return {};
  const guestToken = createGuestToken ? ensureGuestCartToken() : getGuestCartToken();
  return guestToken ? { 'x-guest-cart-token': guestToken } : {};
}

export interface AddCartLineInput {
  variantId: string;
  quantity: number;
  giftWrap?: boolean;
  giftNote?: string;
}

/** Null when there is no identity at all — no account and no guest token yet. */
export async function getCart(token: string | null): Promise<ServerCart | null> {
  const headers = identityHeaders(token);
  if (!token && Object.keys(headers).length === 0) return null;
  return apiFetch<ServerCart>('/cart', { token: token ?? undefined, headers, cache: 'no-store' });
}

export function addCartLine(token: string | null, input: AddCartLineInput) {
  return apiFetch<ServerCart>('/cart/items', {
    method: 'POST',
    token: token ?? undefined,
    headers: identityHeaders(token, true),
    body: JSON.stringify(input),
  });
}

/** Addressed by **line id**: a variant can appear more than once (Invariant 1). */
export function updateCartLine(token: string | null, lineId: string, quantity: number) {
  return apiFetch<ServerCart>(`/cart/items/${lineId}`, {
    method: 'PATCH',
    token: token ?? undefined,
    headers: identityHeaders(token),
    body: JSON.stringify({ quantity }),
  });
}

export function removeCartLine(token: string | null, lineId: string) {
  return apiFetch<ServerCart>(`/cart/items/${lineId}`, {
    method: 'DELETE',
    token: token ?? undefined,
    headers: identityHeaders(token),
  });
}

export function clearCart(token: string | null) {
  return apiFetch<void>('/cart', {
    method: 'DELETE',
    token: token ?? undefined,
    headers: identityHeaders(token),
  });
}

/**
 * Hands this browser's guest cart to the account that just signed in.
 *
 * Called with no strategy first: the API answers `conflict` when both carts
 * hold something, and changes nothing until the customer chooses
 * (Invariant 12).
 */
export function claimGuestCart(token: string, guestToken: string, strategy?: 'merge' | 'replace') {
  return apiFetch<CartClaimResult>('/cart/claim', {
    method: 'POST',
    token,
    body: JSON.stringify({ guestToken, strategy }),
  });
}
