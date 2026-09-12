'use client';

import Image from 'next/image';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { useCartDrawer } from '@/lib/cart-drawer-store';
import { QuantityStepper } from '@/components/product/quantity-stepper';
import { Button } from '@/components/ui/button';
import { getProductStockImage } from '@/lib/jewellery-images';
import { formatMinorUnits } from '@/lib/money';
import type { CartLine } from '@/hooks/use-cart';

/**
 * The bag, slid in from the right after something is added.
 *
 * Replaces the "Added to bag" toast's single "View bag" action. A toast can
 * confirm, but it cannot show what is now in the bag, what it costs, or
 * offer both onward routes — and those are the things that decide whether
 * someone keeps shopping or checks out. The toast is gone rather than kept
 * alongside: two confirmations of one event is one too many.
 *
 * Built on Radix Dialog rather than hand-rolled (see `ADR-0028`). A drawer
 * on the purchase path needs a focus trap, restore-on-close, Escape,
 * scroll lock and correct `aria-modal` semantics; none of that existed in
 * this codebase to copy, and all of it is easy to get subtly wrong.
 *
 * Both onward routes are offered because they are genuinely different
 * intents: Checkout is the primary, View bag is for someone who wants to
 * change quantities or apply a coupon first. Closing is the third answer
 * and stays free — the drawer never navigates on its own.
 */

function DrawerLine({
  line,
  onQuantityChange,
  onRemove,
}: {
  line: CartLine;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex gap-3 border-b border-border py-4 last:border-b-0">
      {/* Not `CartLineItemRow`: that is a three-column grid sized for the
          full bag page and collapses badly at a drawer's width. */}
      <Link
        href={`/product/${line.productSlug}`}
        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-sm bg-surface-alt"
      >
        <Image
          src={line.imageUrl ?? getProductStockImage(line.productSlug)}
          alt={line.productName}
          fill
          sizes="80px"
          className="object-cover"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/product/${line.productSlug}`} className="min-w-0 hover:underline">
            <p className="truncate text-sm font-medium">{line.productName}</p>
          </Link>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${line.productName} from your bag`}
            className="shrink-0 text-ink-muted transition-colors hover:text-ink-primary"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-0.5 text-xs text-ink-secondary">
          {line.metal.replace('_', ' ')}
          {line.size ? ` · ${line.size}` : ''}
        </p>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <QuantityStepper value={line.quantity} onChange={onQuantityChange} />
          <span className="font-display text-sm font-bold">
            {formatMinorUnits(line.unitPriceMinorUnits * line.quantity)}
          </span>
        </div>
      </div>
    </li>
  );
}

export function CartDrawer() {
  const { isOpen, setOpen, close } = useCartDrawer();
  const { lines, updateQuantity, removeLine, subtotalMinorUnits, itemCount } = useCart();

  return (
    <Dialog.Root open={isOpen} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/40 motion-safe:animate-[fade-in_180ms_ease-out]" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[420px] flex-col bg-surface shadow-glass-lg motion-safe:animate-[slide-in-right_260ms_cubic-bezier(0.22,1,0.36,1)]"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <Dialog.Title className="font-display text-lg font-bold">
              {itemCount === 1 ? 'Your bag · 1 piece' : `Your bag · ${itemCount} pieces`}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close your bag"
              className="text-ink-secondary transition-colors hover:text-ink-primary"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>
          </div>

          {lines.length === 0 ? (
            // Reachable: remove the last line without closing the drawer.
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="text-ink-secondary">Your bag is empty.</p>
              <Button asChild variant="secondary" onClick={close}>
                <Link href="/collections/all">Continue shopping</Link>
              </Button>
            </div>
          ) : (
            <>
              <ul className="flex-1 overflow-y-auto px-5">
                {lines.map((line) => (
                  <DrawerLine
                    key={line.id}
                    line={line}
                    onQuantityChange={(quantity) => void updateQuantity(line.id, quantity)}
                    onRemove={() => void removeLine(line.id)}
                  />
                ))}
              </ul>

              <div className="border-t border-border px-5 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-secondary">Subtotal</span>
                  <span className="font-display text-lg font-bold">
                    {formatMinorUnits(subtotalMinorUnits)}
                  </span>
                </div>
                {/* Said here rather than discovered at the last step. */}
                <p className="mt-1 text-xs text-ink-muted">
                  Shipping and taxes are calculated at checkout.
                </p>
                <div className="mt-4 space-y-2.5">
                  <Button asChild size="l" className="w-full" onClick={close}>
                    <Link href="/checkout">Checkout</Link>
                  </Button>
                  <Button asChild variant="secondary" className="w-full" onClick={close}>
                    <Link href="/cart">View bag</Link>
                  </Button>
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
