'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '@/hooks/use-cart';
import { CartLineItemRow } from '@/components/cart/cart-line-item';
import { Button } from '@/components/ui/button';
import { brand } from '@/lib/brand';
import { formatMinorUnits } from '@/lib/money';

export default function CartPage() {
  const { lines, updateQuantity, removeLine, subtotalMinorUnits } = useCart();
  const [giftWrap, setGiftWrap] = useState(false);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);

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
        {lines.map((line) => (
          <CartLineItemRow
            key={line.variantId}
            line={line}
            onQuantityChange={(q) => updateQuantity(line.variantId, q)}
            onRemove={() => removeLine(line.variantId)}
          />
        ))}
      </div>

      {/* Gift wrap + newsletter opt-ins */}
      <div className="mb-6 flex flex-col gap-3.5">
        <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-primary">
          <input
            type="checkbox"
            checked={giftWrap}
            onChange={(e) => setGiftWrap(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-primary"
          />
          {brand.cart.giftWrapLabel}
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-primary">
          <input
            type="checkbox"
            checked={newsletterOptIn}
            onChange={(e) => setNewsletterOptIn(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-primary"
          />
          {brand.cart.newsletterOptInLabel}
        </label>
      </div>

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
      </div>
    </div>
  );
}
