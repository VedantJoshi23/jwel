'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWishlistToggle } from '@/hooks/use-wishlist-toggle';

/**
 * Save/unsave the selected variant. See `useWishlistToggle` for why this is
 * per-variant and why a logged-out visitor is sent to log in rather than
 * shown a control that would just fail.
 */
export function SaveToWishlist({ variantId, productName }: { variantId: string; productName: string }) {
  const { isAuthenticated, saved, isPending, toggle } = useWishlistToggle(variantId);

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
      loading={isPending}
      onClick={toggle}
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
