'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/common/error-state';

/**
 * Checkout's own boundary, separate from the storefront one because the
 * question a customer has here is not "what went wrong" but **"have I been
 * charged?"** — and this boundary genuinely does not know. It renders after a
 * client-side throw, which can happen either side of the payment handoff.
 *
 * So it says so. Telling them the order failed risks a duplicate purchase;
 * telling them it succeeded risks them walking away from an unpaid bag. Law 1
 * applies to reassurance as much as to feature copy: pointing them at the
 * order history, which is authoritative, is the only honest answer.
 *
 * Deliberately offers no "try again" that re-submits. `reset` would re-render
 * the checkout form with the bag intact, which is indistinguishable to the
 * customer from "pay again" — the route back is through their orders.
 */
export default function CheckoutError({ error }: { error: Error & { digest?: string } }) {
  return (
    <ErrorState
      title="Your checkout was interrupted"
      description={
        'Something went wrong while placing your order. We cannot tell from here whether the ' +
        'payment went through, so please check your orders before trying again — if it is ' +
        'listed there, it went through and you have not been charged twice.'
      }
      digest={error.digest}
    >
      <Button asChild size="l">
        <Link href="/profile">Check my orders</Link>
      </Button>
      <Button asChild variant="secondary" size="l">
        <Link href="/cart">Back to bag</Link>
      </Button>
    </ErrorState>
  );
}
