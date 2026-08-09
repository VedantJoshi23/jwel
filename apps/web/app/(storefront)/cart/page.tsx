'use client';

import Link from 'next/link';
import { useCart } from '@/hooks/use-cart';
import { CartLineItemRow } from '@/components/cart/cart-line-item';
import { Button } from '@/components/ui/button';
import { brand } from '@/lib/brand';
import { ShareCart } from '@/components/cart/share-cart';
import { formatMinorUnits } from '@/lib/money';

export default function CartPage() {
  const { lines, updateQuantity, removeLine, subtotalMinorUnits, isLoading } = useCart();

  // Distinguished from empty on purpose: the bag is fetched now, and showing
  // "your bag is empty" while it loads tells a shopper their items are gone.
  if (isLoading) {
    return (
      <div className="px-6 py-16 text-center lg:px-8">
        <p className="text-ink-secondary">Loading your bag…</p>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="px-6 py-16 text-center lg:px-8">
        <p className="text-ink-secondary">{brand.cart.emptyMessage}</p>
        <Button asChild className="mt-5">
          <Link href="/collections/all">{brand.cart.continueCta}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 lg:px-8">
      {/* Back link */}
      <Link href="/collections/all" className="mb-3 flex items-center gap-1.5 text-sm text-ink-primary hover:underline">
        <span>‹</span> Back
      </Link>

      <h1 className="mb-6 font-display text-4xl font-bold tracking-tight">{brand.cart.headline}</h1>


      {/* Cart item(s) — bordered card matching wireframe 05 */}
      <div className="mb-6 border border-border-sale">
        {/* Keyed and addressed by line id — the same variant can appear
            twice with different gift options (DOM-SHOPPING Invariant 1). */}
        {lines.map((line) => (
          <CartLineItemRow
            key={line.id}
            line={line}
            onQuantityChange={(q) => void updateQuantity(line.id, q)}
            onRemove={() => void removeLine(line.id)}
          />
        ))}
      </div>

      {/*
        The cart-wide gift-wrap checkbox that used to sit here was local state
        that went nowhere — never sent, never stored. Gift wrap is **per line**
        (DOM-SHOPPING Invariant 4) and the server now holds it, so a single
        cart-level switch could not express it even in principle.

        The newsletter opt-in was the same: a checkbox with nothing behind it.
        It is now tracked as an outstanding storefront claim rather than
        quietly collecting clicks — see lib/storefront-claims.ts.
      */}

      {/* Subtotal summary */}
      <div className="mb-6 border border-border-sale p-5">
        <div className="flex justify-between text-sm font-medium">
          <span>Subtotal</span>
          <span>{formatMinorUnits(subtotalMinorUnits)}</span>
        </div>
        <p className="mt-1 text-xs text-ink-muted">Taxes and shipping calculated at checkout</p>
      </div>

      {/* CTAs */}
      <div className="flex flex-wrap gap-3">
        <Button asChild size="l">
          <Link href="/checkout">{brand.cart.checkoutCta}</Link>
        </Button>
        <Button asChild variant="secondary" size="l">
          <Link href="/collections/all">{brand.cart.continueCta}</Link>
        </Button>
        {/* Gift options are per line (Invariant 4) and the local cart does not
            carry them yet, so a share currently freezes variants and
            quantities only — see FEAT-SHAREABLE-CART §9. */}
        <ShareCart lines={lines} />
      </div>
    </div>
  );
}
