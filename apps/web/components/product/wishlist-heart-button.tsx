'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWishlistToggle } from '@/hooks/use-wishlist-toggle';

/**
 * The compact heart overlay on a product card (see the client's reference
 * image). `SaveToWishlist` is the PDP's full-width labelled button; this is
 * the same toggle in the icon-only shape a card corner needs — both go
 * through `useWishlistToggle` so they can never disagree about what "saved"
 * means for a given variant.
 *
 * Deliberately a sibling of the card's image `<Link>`, never a descendant of
 * it: a `<button>` nested inside an `<a>` is invalid HTML (interactive
 * content inside interactive content) and browsers handle the click
 * ambiguously. Absolutely positioning this over the image achieves the same
 * visual overlap without that problem, and without needing
 * `stopPropagation`/`preventDefault` gymnastics on every click.
 */
export function WishlistHeartButton({
  variantId,
  productName,
  className,
}: {
  variantId: string;
  productName: string;
  className?: string;
}) {
  const { isAuthenticated, saved, isPending, toggle } = useWishlistToggle(variantId);

  const base =
    'flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 text-ink-primary shadow-card backdrop-blur transition-colors hover:bg-surface';

  if (!isAuthenticated) {
    return (
      <Link
        href="/login?next=/wishlist"
        aria-label={`Log in to save ${productName} to your wishlist`}
        className={cn(base, className)}
      >
        <Heart className="h-4 w-4" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={toggle}
      // Label, not just the icon fill, carries the state — the same rule
      // SaveToWishlist follows (STD-ACCESSIBILITY rule 6).
      aria-label={saved ? `Remove ${productName} from your wishlist` : `Save ${productName} to your wishlist`}
      aria-pressed={saved}
      className={cn(base, saved && 'text-brand-primary', className)}
    >
      <Heart className={saved ? 'h-4 w-4 fill-current' : 'h-4 w-4'} aria-hidden="true" />
    </button>
  );
}
