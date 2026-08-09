import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { getSharedWishlist } from '@/lib/api/wishlist';
import { formatMinorUnits } from '@/lib/money';
import { ApiError } from '@/lib/api/client';

/**
 * A shared wishlist, opened by anyone holding the link.
 *
 * `DOM-SHOPPING` Invariant 9: **read-only to the recipient, and the owner's
 * identity is never exposed.** So there is no add, no remove, no "save all" —
 * and nothing here names whose list it is, because the API does not say. It
 * returns `{ items }` and nothing more.
 *
 * Prices are read now, not at share time: Invariant 11 splits a shared cart
 * into a snapshot of *what* and a live read of *cost and availability*. A
 * wishlist has no configuration to snapshot, so all of it is live.
 *
 * `noindex`: an unguessable token is the only credential, and a search engine
 * that crawled one would turn a private link into a public page.
 */
export const metadata: Metadata = {
  title: 'A shared wishlist',
  robots: { index: false, follow: false },
};

export default async function SharedWishlistPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let items;
  try {
    ({ items } = await getSharedWishlist(token));
  } catch (error) {
    // A bad or retired token is a 404, not an error page — the link is simply
    // not a thing, and saying more would confirm which tokens exist.
    if (error instanceof ApiError && error.statusCode === 404) notFound();
    throw error;
  }

  return (
    <div>
      <PageHeader title="A shared wishlist" subtitle="Someone wanted you to see these pieces." />
      <div className="mx-auto max-w-3xl px-6 py-12 lg:px-8">
        {items.length === 0 ? (
          <p className="text-ink-secondary">There is nothing in this wishlist yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <Link
                    href={`/product/${item.variant.product.slug}`}
                    className="font-medium underline"
                  >
                    {item.variant.product.name}
                  </Link>
                  <p className="text-sm text-ink-secondary">
                    {item.variant.metal}
                    {item.variant.size && ` · Size ${item.variant.size}`}
                  </p>
                </div>
                <span className="font-medium">
                  {formatMinorUnits(item.variant.basePriceMinorUnits)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <Button asChild className="mt-10">
          <Link href="/collections/all">Browse the collection</Link>
        </Button>
      </div>
    </div>
  );
}
