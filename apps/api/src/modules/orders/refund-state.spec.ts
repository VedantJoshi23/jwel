import { ReturnStatus } from '@prisma/client';
import { deriveRefundState } from './refund-state';

/**
 * DOM-RETURNS invariants 8 and 9, and the edge cases in its §8 that decide
 * where the boundary between "refunded" and "partially returned" sits.
 */
describe('deriveRefundState', () => {
  const item = (returnStatus: ReturnStatus | null = null) => ({ returnStatus });
  const refunded = () => item(ReturnStatus.REFUNDED);

  it('is neither for an order with no returns at all', () => {
    expect(deriveRefundState([item(), item()])).toEqual({
      fullyRefunded: false,
      partiallyReturned: false,
    });
  });

  it('is fully refunded when every item came back (invariant 8)', () => {
    expect(deriveRefundState([refunded(), refunded()])).toEqual({
      fullyRefunded: true,
      partiallyReturned: false,
    });
  });

  it('is partial when some but not all came back (invariant 9)', () => {
    expect(deriveRefundState([refunded(), item()])).toEqual({
      fullyRefunded: false,
      partiallyReturned: true,
    });
  });

  it('treats a single-item order as complete, not partial (§8.9)', () => {
    // One refunded out of one is the whole order. Invariants 8 and 9 must not
    // both fire — it becomes REFUNDED and carries no differentiator.
    expect(deriveRefundState([refunded()])).toEqual({
      fullyRefunded: true,
      partiallyReturned: false,
    });
  });

  it('does not count a REJECTED return as a refund (§8.10)', () => {
    // A rejected return is not a refund. It must not make the order look
    // partially returned to an admin.
    expect(deriveRefundState([item(ReturnStatus.REJECTED), item()])).toEqual({
      fullyRefunded: false,
      partiallyReturned: false,
    });
  });

  it('does not count a return still working through the lifecycle', () => {
    // Money has not moved yet for any of these.
    for (const status of [
      ReturnStatus.REQUESTED,
      ReturnStatus.APPROVED,
      ReturnStatus.REFUND_PROCESSING,
    ]) {
      expect(deriveRefundState([item(status), item()])).toEqual({
        fullyRefunded: false,
        partiallyReturned: false,
      });
    }
  });

  it('is not fully refunded when the last item is only APPROVED', () => {
    expect(deriveRefundState([refunded(), item(ReturnStatus.APPROVED)])).toEqual({
      fullyRefunded: false,
      partiallyReturned: true,
    });
  });

  it('refuses to call an empty order refunded', () => {
    // `every` on an empty array is true, which would make an order with no
    // items silently fully refunded. Checkout forbids that state; this is the
    // guard that stops the arithmetic inventing it.
    expect(deriveRefundState([])).toEqual({ fullyRefunded: false, partiallyReturned: false });
  });
});
