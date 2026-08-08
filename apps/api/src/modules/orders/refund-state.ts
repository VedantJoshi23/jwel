import { ReturnStatus } from '@prisma/client';

/**
 * `DOM-RETURNS` invariants 8 and 9 — what the returns attached to an order say
 * about the order as a whole.
 *
 * Both invariants read the same shape, which is why they are derived together:
 * an order is `REFUNDED` when **every** item came back, and *partially
 * returned* when some did but not all. Deriving them apart would let the two
 * disagree.
 *
 * Nothing here is stored. The returns table already knows this, and a
 * `partiallyReturned` column would be a second source of truth for it
 * (`STD-DATABASE` r9) that goes stale the moment a return advances.
 */

export interface OrderItemReturnState {
  /** The item's return request, if it has one. Null when never requested. */
  returnStatus: ReturnStatus | null;
}

export interface OrderRefundState {
  /** Every item has a `REFUNDED` return — invariant 8's condition. */
  fullyRefunded: boolean;
  /** Some but not all items have one — invariant 9's differentiator. */
  partiallyReturned: boolean;
}

export function deriveRefundState(items: OrderItemReturnState[]): OrderRefundState {
  // An order with no items cannot be refunded into existence. Defensive: the
  // checkout path forbids it, but `every` on an empty array is true, which
  // would make an empty order silently "fully refunded".
  if (items.length === 0) {
    return { fullyRefunded: false, partiallyReturned: false };
  }

  // Only REFUNDED counts. A REJECTED return is not a refund, and neither is
  // one still working through the lifecycle — money has not moved yet
  // (`DOM-RETURNS` §8.10).
  const refunded = items.filter((item) => item.returnStatus === ReturnStatus.REFUNDED).length;

  return {
    fullyRefunded: refunded === items.length,
    // Strictly between none and all. A single-item order whose one item is
    // refunded is *complete*, not partial — it becomes REFUNDED and carries no
    // differentiator (`DOM-RETURNS` §8.9).
    partiallyReturned: refunded > 0 && refunded < items.length,
  };
}
