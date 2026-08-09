import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/common/page-header';
import { AdoptSharedCart } from '@/components/cart/adopt-shared-cart';
import { getSharedCart } from '@/lib/api/cart-share';
import { formatMinorUnits } from '@/lib/money';
import { ApiError } from '@/lib/api/client';

/**
 * A shared cart — `DOM-SHOPPING` Invariant 11.
 *
 * **Frozen in what, live in how much.** Which variants, quantities and gift
 * options were shared was fixed when the link was made; the prices and
 * availability below were read just now. That split is the whole design: the
 * sender editing their own bag afterwards cannot rewrite what you see, and you
 * are never shown a price you cannot actually pay.
 *
 * `noindex` for the same reason as the shared wishlist — an unguessable token
 * is the only credential, and a crawler that found one would make a private
 * link public.
 */
export const metadata: Metadata = {
  title: 'A shared bag',
  robots: { index: false, follow: false },
};

export default async function SharedCartPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let items;
  try {
    ({ items } = await getSharedCart(token));
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) notFound();
    throw error;
  }

  const unavailableCount = items.filter((item) => !item.available).length;

  return (
    <div>
      <PageHeader title="A shared bag" subtitle="Someone picked these out for you to see." />
      <div className="mx-auto max-w-3xl px-6 py-12 lg:px-8">
        <ul className="divide-y divide-border">
          {items.map((item, index) => (
            // Keyed by position: the same variant can appear twice with
            // different gift options, which Invariant 1 makes two lines.
            <li key={`${item.variantId}-${index}`} className="flex items-center justify-between gap-4 py-4">
              <div>
                {item.available ? (
                  <Link href={`/product/${item.productSlug}`} className="font-medium underline">
                    {item.productName}
                  </Link>
                ) : (
                  <p className="font-medium text-ink-muted">{item.productName}</p>
                )}
                <p className="text-sm text-ink-secondary">
                  {item.metal}
                  {item.size && ` · Size ${item.size}`} · Qty {item.quantity}
                  {item.giftWrap && ' · Gift wrapped'}
                </p>
                {item.giftNote && (
                  <p className="mt-1 text-sm italic text-ink-secondary">“{item.giftNote}”</p>
                )}
                {!item.available && (
                  <p className="mt-1 text-sm text-feedback-warning">
                    No longer available — it cannot be added to your bag.
                  </p>
                )}
              </div>
              <span className="font-medium">
                {formatMinorUnits(item.unitPriceMinorUnits * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        {unavailableCount > 0 && (
          <p className="mt-4 text-sm text-ink-secondary">
            Prices and availability are current as of now, not when this bag was shared.
          </p>
        )}

        <div className="mt-10">
          <AdoptSharedCart lines={items} />
        </div>
      </div>
    </div>
  );
}
