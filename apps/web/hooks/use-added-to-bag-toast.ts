'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

/**
 * The "Added to bag" confirmation, with a way to act on it.
 *
 * Adding a piece used to confirm and stop there, leaving the bag reachable
 * only by going and finding the header's cart button — so the one moment a
 * shopper has actually decided something was the moment the site asked
 * nothing of them. The toast now carries the follow-on step, which is the
 * ordinary pattern elsewhere in commerce.
 *
 * Deliberately one action, not two. "View bag" and "Checkout" side by side
 * in a toast is a fork at the exact moment the shopper has just answered a
 * different question, and the bag page already carries checkout as its
 * primary control — so the second button would buy a click at the cost of a
 * decision. Dismissing is the "no, keep shopping" answer and stays the
 * default: the toast is a prompt, not a redirect, which is the reason this
 * is a toast action rather than an automatic `router.push`.
 *
 * Longer-lived than a plain confirmation, because a toast you are expected
 * to act on must outlast the time it takes to read it.
 *
 * Shared so the three places that add a line — the PDP, a product card's
 * quick-add, and the wishlist — cannot drift apart in wording or behaviour.
 * `components/cart/adopt-shared-cart.tsx` deliberately does not use this:
 * it already navigates to the bag itself, so a prompt to go there would be
 * offering a journey the visitor is mid-way through.
 */

const ACTIONABLE_TOAST_MS = 8000;

export function useAddedToBagToast() {
  const router = useRouter();

  return useCallback(
    (description?: string) => {
      toast.success('Added to bag', {
        description,
        duration: ACTIONABLE_TOAST_MS,
        action: {
          label: 'View bag',
          onClick: () => router.push('/cart'),
        },
      });
    },
    [router],
  );
}
