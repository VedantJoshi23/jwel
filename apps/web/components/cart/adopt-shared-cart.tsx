'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useCart } from '@/hooks/use-cart';
import { addToWishlist } from '@/lib/api/wishlist';
import type { SharedCartLine } from '@/lib/api/cart-share';

/**
 * Adopting a shared cart — `DOM-SHOPPING` Invariants 12 to 16.
 *
 * The rules, in the order they apply:
 *
 * - **12.** An empty cart adopts silently. A non-empty one is *asked*: merge
 *   or replace. Nothing is ever discarded without the recipient choosing.
 * - **13.** Replace moves the recipient's current lines to their **wishlist**
 *   first. A guest must sign in before choosing it, because a wishlist needs a
 *   registered user — so replace is offered but blocked with an explanation,
 *   rather than hidden.
 * - **14.** Those wishlist writes are upsert-and-ignore: the API returns the
 *   wishlist unchanged for an item already saved, so a failure there must not
 *   abort the adoption.
 * - **15.** Merge sums quantities for matching lines.
 * - **16.** Adopted lines are **copied**. Once adopted, the sender can no
 *   longer affect them — which is why this writes to the local cart and never
 *   holds on to the token.
 *
 * Unavailable lines are never adopted, in either path.
 */
export function AdoptSharedCart({ lines }: { lines: SharedCartLine[] }) {
  const router = useRouter();
  const { token, isAuthenticated } = useAuth();
  const { lines: cartLines, addLine, clear } = useCart();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const adoptable = lines.filter((line) => line.available);
  const hasOwnCart = cartLines.length > 0;

  /**
   * Invariant 15 — the server sums quantities for a line with matching
   * variant *and* configuration, and keeps differing configurations separate.
   * That used to be the browser store's job and is now the API's, which is
   * where Invariant 1 is actually enforced.
   */
  async function merge() {
    setBusy(true);
    for (const line of adoptable) {
      await addLine({
        variantId: line.variantId,
        quantity: line.quantity,
        giftWrap: line.giftWrap,
        giftNote: line.giftNote ?? undefined,
      });
    }
    router.push('/cart');
  }

  /** Invariant 13 — wishlist first, then replace. */
  async function replace() {
    setBusy(true);
    setNote('');

    const saved: string[] = [];
    for (const line of cartLines) {
      try {
        await addToWishlist(token!, line.variantId);
        saved.push(line.productName);
      } catch {
        // Upsert-and-ignore (Invariant 14). A wishlist write that fails must
        // not strand the recipient between two carts, so the adoption
        // continues and the message below stays honest about what was saved.
      }
    }

    await clear();
    for (const line of adoptable) {
      await addLine({
        variantId: line.variantId,
        quantity: line.quantity,
        giftWrap: line.giftWrap,
        giftNote: line.giftNote ?? undefined,
      });
    }

    if (saved.length < cartLines.length) {
      setNote('Some of your pieces could not be saved to your wishlist.');
    }
    router.push('/cart');
  }

  if (adoptable.length === 0) {
    return (
      <p className="text-ink-secondary">
        None of these pieces are available at the moment, so there is nothing to add to your bag.
      </p>
    );
  }

  // Invariant 12 — an empty cart adopts with no prompt.
  if (!hasOwnCart) {
    return (
      <Button size="l" loading={busy} onClick={merge}>
        Add these to my bag
      </Button>
    );
  }

  return (
    <Card>
      <CardContent>
        <h2 className="font-display text-lg font-bold">You already have a bag</h2>
        <p className="mt-1 text-sm text-ink-secondary">
          You have {cartLines.length} piece{cartLines.length === 1 ? '' : 's'} of your own. Choose
          what to do — nothing is thrown away either way.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="s" loading={busy} onClick={merge}>
            Add to what I have
          </Button>

          {isAuthenticated ? (
            <Button size="s" variant="secondary" loading={busy} onClick={replace}>
              Replace mine (my pieces move to my wishlist)
            </Button>
          ) : (
            // Invariant 13's guest blocker. Offered and explained rather than
            // hidden, so the choice does not silently disappear for guests.
            <Button asChild size="s" variant="secondary">
              <Link href="/login?next=/cart">Log in to replace and save yours</Link>
            </Button>
          )}
        </div>

        {note && (
          <p role="status" className="mt-3 text-sm text-feedback-warning">
            {note}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
