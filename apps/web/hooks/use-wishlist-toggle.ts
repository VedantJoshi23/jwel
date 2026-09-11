'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { addToWishlist, getWishlist, removeFromWishlist } from '@/lib/api/wishlist';

/**
 * Shared by `SaveToWishlist` (the PDP's full-width button) and the compact
 * heart overlay on a product card — both toggle the same thing, a saved
 * **variant**, not a product (`DOM-SHOPPING` Invariant 7: a wishlist line is
 * unique on `(wishlistId, variantId)` and carries no quantity), and both need
 * the identical auth gate: there is no guest wishlist (Invariant 13), so a
 * logged-out visitor cannot be shown a control that would just 401.
 *
 * Extracted rather than duplicated once a second consumer needed it — one
 * query key, one invalidation path, one place to get the auth gate right.
 */
export function useWishlistToggle(variantId: string) {
  const { token, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const wishlist = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => getWishlist(token!),
    enabled: Boolean(token),
  });

  const saved = wishlist.data?.items.some((item) => item.variantId === variantId) ?? false;

  const mutation = useMutation({
    mutationFn: () =>
      saved ? removeFromWishlist(token!, variantId) : addToWishlist(token!, variantId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
  });

  return {
    isAuthenticated,
    saved,
    isPending: mutation.isPending,
    toggle: () => mutation.mutate(),
  };
}
