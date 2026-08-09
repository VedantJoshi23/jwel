import { apiFetch } from './client';
import type { SharedWishlist, Wishlist } from './types';

/**
 * `DOM-SHOPPING` §4 — the wishlist API has existed since the module was built
 * and **no storefront UI reached it** (KC-115). This is that UI's client.
 *
 * The share endpoint is deliberately unauthenticated: a share token is an
 * unguessable bearer credential, and Invariant 9 makes a shared view
 * **read-only**, with the owner's identity never exposed. The API returns only
 * `{ items }` for that reason — no user id, no name, no counts of anything
 * else the owner has.
 */

export function getWishlist(token: string) {
  return apiFetch<Wishlist>('/wishlist', { token, cache: 'no-store' });
}

export function addToWishlist(token: string, variantId: string) {
  return apiFetch<Wishlist>('/wishlist/items', {
    method: 'POST',
    token,
    body: JSON.stringify({ variantId }),
  });
}

export function removeFromWishlist(token: string, variantId: string) {
  return apiFetch<Wishlist>(`/wishlist/items/${variantId}`, { method: 'DELETE', token });
}

/** Public — no token. The share link is the only credential. */
export function getSharedWishlist(shareToken: string) {
  return apiFetch<SharedWishlist>(`/wishlist/shared/${shareToken}`, { cache: 'no-store' });
}
