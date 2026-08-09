'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { claimGuestCart } from '@/lib/api/cart';
import { clearGuestCartToken, getGuestCartToken } from '@/lib/guest-cart-token';
import type { ServerCart } from '@/lib/api/types';

/**
 * Hands this browser's guest bag to the account that just signed in —
 * `DOM-SHOPPING` Invariants 6, 12 and 17.
 *
 * Runs once when a token appears. The first call carries **no strategy**: the
 * API answers `conflict` when both bags hold something and changes nothing,
 * because Invariant 12 forbids discarding either side without being told to.
 * This component is the prompt that was missing.
 *
 * **The wording of "replace" matters.** Both bags belong to the same person,
 * so it has to say which one survives. It keeps what they are holding now —
 * the guest bag — and the older one goes to their wishlist. The reverse would
 * throw away what they assembled minutes ago.
 *
 * And it says *moved to your wishlist*, never "we saved your bag": a wishlist
 * entry carries no quantity, gift wrap or note, so three wrapped rings come
 * back as one saved ring (`DOM-SHOPPING`'s "two consequences").
 */
export function ClaimGuestCart() {
  const { token, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [conflict, setConflict] = useState<{ mine: ServerCart; guest: ServerCart } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const guestToken = getGuestCartToken();
    if (!isAuthenticated || !token || !guestToken) return;

    let cancelled = false;
    void (async () => {
      try {
        const result = await claimGuestCart(token, guestToken);
        if (cancelled) return;

        if (result.outcome === 'conflict' && result.guestCart) {
          setConflict({ mine: result.cart, guest: result.guestCart });
          return;
        }

        // Adopted, merged, or there was nothing to hand over. Either way this
        // browser's guest token now points at a cart that no longer exists.
        clearGuestCartToken();
        await queryClient.invalidateQueries({ queryKey: ['cart'] });
      } catch {
        // A failed claim leaves the guest bag where it is and the account bag
        // untouched. Nothing is lost, and the next sign-in tries again — which
        // is why this stays silent rather than alarming someone mid-login.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, token, queryClient]);

  async function choose(strategy: 'merge' | 'replace') {
    const guestToken = getGuestCartToken();
    if (!token || !guestToken) return;

    setBusy(true);
    try {
      await claimGuestCart(token, guestToken, strategy);
      clearGuestCartToken();
      setConflict(null);
      await queryClient.invalidateQueries({ queryKey: ['cart'] });
    } finally {
      setBusy(false);
    }
  }

  if (!conflict) return null;

  const guestCount = conflict.guest.items.length;
  const mineCount = conflict.mine.items.length;

  return (
    <Card className="mb-6">
      <CardContent>
        <h2 className="font-display text-lg font-bold">You have two bags</h2>
        <p className="mt-1 text-sm text-ink-secondary">
          There {guestCount === 1 ? 'is 1 piece' : `are ${guestCount} pieces`} in the bag you were
          just building, and {mineCount === 1 ? '1 piece' : `${mineCount} pieces`} saved to your
          account from before. Nothing is thrown away either way.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="s" loading={busy} onClick={() => choose('merge')}>
            Keep both
          </Button>
          <Button size="s" variant="secondary" loading={busy} onClick={() => choose('replace')}>
            Keep the bag I was just building — move the older pieces to my wishlist
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
