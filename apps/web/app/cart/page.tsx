'use client';

// Client-rendered (no SSR) — the bag's contents live in localStorage via
// useCartStore, which doesn't exist on the server. See FRONTEND.md for why
// this is the one page category that trades SSR for client-side cart state.

import Link from 'next/link';
import { useCart } from '@/hooks/use-cart';
import { CartLineItemRow } from '@/components/cart/cart-line-item';
import { OrderSummary } from '@/components/cart/order-summary';
import { Button } from '@/components/ui/button';

export default function CartPage() {
  const { lines, updateQuantity, removeLine, subtotalMinorUnits } = useCart();

  return (
    <div className="px-6 py-8 lg:px-8">
      <h1 className="mb-6 font-display text-4xl font-bold">My shopping bag</h1>

      {lines.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-ink-secondary">Your bag is empty.</p>
          <Button asChild className="mt-5">
            <Link href="/collections/all">Continue shopping</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <div>
            {lines.map((line) => (
              <CartLineItemRow
                key={line.variantId}
                line={line}
                onQuantityChange={(q) => updateQuantity(line.variantId, q)}
                onRemove={() => removeLine(line.variantId)}
              />
            ))}
          </div>

          <div className="space-y-5">
            <OrderSummary subtotalMinorUnits={subtotalMinorUnits} />
            <Button asChild size="l" className="w-full">
              <Link href="/checkout">Go to checkout</Link>
            </Button>
            <Button asChild variant="secondary" size="l" className="w-full">
              <Link href="/collections/all">Back to store</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
