'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { addToWishlist, getWishlist, removeFromWishlist } from '@/lib/api/wishlist';

/**
 * Save/unsave the selected variant.
 *
 * A wishlist belongs to a registered user — there is no guest wishlist, and
 * `DOM-SHOPPING` Invariant 13 leans on that fact — so a logged-out visitor is
 * sent to log in rather than shown a control that would fail. A save button
 * that 401s is a surface asserting a capability the visitor does not have.
 *
 * Saving is per **variant**, not per product, because that is what the wishlist
 * stores: a line is unique on `(wishlistId, variantId)` and carries no
 * quantity (Invariant 7). Saving the gold ring and the silver one is two
 * entries, which is the intent.
 */
export function SaveToWishlist({ variantId, productName }: { variantId: string; productName: string }) {
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

  if (!isAuthenticated) {
    return (
      <Button asChild variant="secondary" size="l" className="w-full">
        <Link href="/login?next=/wishlist">
          <Heart className="h-4 w-4" aria-hidden="true" />
          Log in to save this
        </Link>
      </Button>
    );
  }

  return (
    <Button
      variant="secondary"
      size="l"
      className="w-full"
      loading={mutation.isPending}
      onClick={() => mutation.mutate()}
      // The label carries the state, not the icon's fill — a filled heart
      // alone would be colour and shape doing the work of words
      // (STD-ACCESSIBILITY rule 6).
      aria-pressed={saved}
    >
      <Heart className={saved ? 'h-4 w-4 fill-current' : 'h-4 w-4'} aria-hidden="true" />
      {saved ? 'Saved to wishlist' : 'Save to wishlist'}
      <span className="sr-only"> — {productName}</span>
    </Button>
  );
}
