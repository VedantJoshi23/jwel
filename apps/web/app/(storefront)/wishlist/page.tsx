'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useCart } from '@/hooks/use-cart';
import { getWishlist, removeFromWishlist } from '@/lib/api/wishlist';
import { formatMinorUnits } from '@/lib/money';
import { brand } from '@/lib/brand';
import type { WishlistItem } from '@/lib/api/types';

/**
 * A saved piece whose product has since been unpublished, archived or deleted.
 *
 * Shown rather than hidden: the customer chose to save it, and a list that
 * quietly shrinks is worse than one that explains itself. The shared view does
 * the opposite and filters these out, because that URL is public and would
 * otherwise leak unpublished catalogue.
 */
function isUnavailable(item: WishlistItem): boolean {
  const { status, deletedAt } = item.variant.product;
  // `status` is absent on a shared wishlist, where the API has already
  // filtered; absent means "nothing says otherwise", so available.
  return (status !== undefined && status !== 'PUBLISHED') || Boolean(deletedAt);
}

/**
 * The wishlist, and the share link the API has carried since it was built.
 *
 * `DOM-SHOPPING` §4 recorded this surface as missing (KC-115): every endpoint
 * existed, `Wishlist.shareToken` was generated for every wishlist, and nothing
 * in the storefront could reach any of it.
 */
export default function WishlistPage() {
  const { token, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { addLine } = useCart();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => getWishlist(token!),
    enabled: Boolean(token),
  });

  const remove = useMutation({
    mutationFn: (variantId: string) => removeFromWishlist(token!, variantId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
  });

  if (!isAuthenticated) {
    return (
      <div className="px-6 py-16 text-center lg:px-8">
        <p className="text-ink-secondary">Log in to see the pieces you have saved.</p>
        <Button asChild className="mt-5">
          <Link href="/login?next=/wishlist">Log in</Link>
        </Button>
      </div>
    );
  }

  const items = data?.items ?? [];
  const shareUrl =
    data && typeof window !== 'undefined'
      ? `${window.location.origin}/wishlist/shared/${data.shareToken}`
      : '';

  function handleAddToBag(item: WishlistItem) {
    // Previously fire-and-forget with no feedback at all — the one surface on
    // this page with nothing telling the visitor their click did anything.
    void addLine({ variantId: item.variantId, quantity: 1 });
    toast.success('Added to bag', { description: item.variant.product.name });
  }

  return (
    <div>
      <PageHeader title="Wishlist" subtitle="The pieces you are thinking about." />
      <div className="mx-auto max-w-3xl px-6 py-12 lg:px-8">
        {isLoading && <p className="text-ink-secondary">Loading your wishlist…</p>}

        {!isLoading && items.length === 0 && (
          <p className="text-ink-secondary">
            Nothing saved yet. Tap “Save to wishlist” on any piece to keep it here.
          </p>
        )}

        {items.length > 0 && (
          <>
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 py-4">
                  <div>
                    {isUnavailable(item) ? (
                      // No link: it would lead to a 404, which is a worse
                      // answer than the sentence underneath.
                      <p className="font-medium text-ink-muted">{item.variant.product.name}</p>
                    ) : (
                      <Link href={`/product/${item.variant.product.slug}`} className="font-medium underline">
                        {item.variant.product.name}
                      </Link>
                    )}
                    <p className="text-sm text-ink-secondary">
                      {item.variant.metal}
                      {item.variant.size && ` · Size ${item.variant.size}`}
                    </p>
                    {isUnavailable(item) && (
                      <p className="mt-1 text-sm text-feedback-warning">
                        No longer available. You can remove it, or keep it saved in case it returns.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Live price, read now rather than at save time — a saved
                        piece is a reminder, not a quote. */}
                    <span className="font-medium">
                      {formatMinorUnits(item.variant.basePriceMinorUnits)}
                    </span>
                    {!isUnavailable(item) && (
                    <Button size="s" onClick={() => handleAddToBag(item)}>
                      Add to bag
                    </Button>
                    )}
                    <Button
                      size="s"
                      variant="ghost"
                      loading={remove.isPending}
                      onClick={() => remove.mutate(item.variantId)}
                    >
                      Remove
                      <span className="sr-only"> {item.variant.product.name}</span>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <Card className="mt-10">
              <CardContent>
                <h2 className="font-display text-lg font-bold">Share your wishlist</h2>
                <p className="mt-1 text-sm text-ink-secondary">
                  Anyone with this link can see these pieces. They cannot change your list, and it
                  does not show them who you are.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="s"
                    onClick={async () => {
                      await navigator.clipboard.writeText(shareUrl);
                      setCopied(true);
                    }}
                  >
                    Copy link
                  </Button>
                  {/*
                    The journey this share token was built for. It is a
                    click-to-chat link, the same mechanism as the footer's
                    "WhatsApp us" — no Business API involved.
                  */}
                  <Button asChild variant="secondary" size="s">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `My ${brand.name} wishlist: ${shareUrl}`,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Share on WhatsApp
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </Button>
                </div>

                <p role="status" aria-live="polite" className="mt-2 text-sm text-feedback-success">
                  {copied ? 'Link copied.' : ''}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
