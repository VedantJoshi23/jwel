/**
 * `DOM-RETURNS` Invariant 3 — the return window.
 *
 * Until now nothing enforced a window at all: `create` checked only that the
 * order was `DELIVERED` and that the item had no existing request, so an order
 * delivered a year ago was as returnable as one delivered this morning. The
 * window is application-layer rather than a database constraint because it
 * depends on runtime configuration (`DOM-RETURNS` §9 row 4) — the number of
 * days comes from `FEAT-SETTINGS-STORE`'s `returns.window_days`.
 *
 * A pure function over an already-loaded delivery date so the boundary
 * arithmetic is testable without a Prisma mock or a clock (`STD-TESTING` r6).
 */

export type ReturnEligibility =
  | { eligible: true; deadline: Date }
  | { eligible: false; reason: string };

/**
 * @param deliveredAt when the order entered `DELIVERED` — read from the
 *   `OrderStatusHistory` entry, **never** `Order.updatedAt`, which moves for
 *   unrelated reasons (`DOM-RETURNS` §8.1). Null when no such entry exists.
 * @param windowDays from `returns.window_days`.
 * @param now evaluated at **request time**. A later change to the window does
 *   not retroactively invalidate an accepted request (`DOM-RETURNS` §8.3).
 */
export function checkReturnWindow(
  deliveredAt: Date | null,
  windowDays: number,
  now: Date,
): ReturnEligibility {
  if (!deliveredAt) {
    // Every DELIVERED transition writes a history row, so this is a data
    // defect rather than a normal state. Refusing is the honest answer — the
    // alternative is to invent a delivery date and enforce a window against
    // it — and Invariant 6 already routes exceptions to support out of band.
    return {
      eligible: false,
      reason:
        'We could not determine when this order was delivered, so the return window cannot be ' +
        'checked. Please contact support.',
    };
  }

  const deadline = new Date(deliveredAt.getTime() + windowDays * 24 * 60 * 60 * 1000);

  // Day 10 is inside, day 11 is outside (§8.1). Measured to the millisecond
  // from the delivery timestamp rather than from midnight: a calendar-day
  // reading would make the window's real length depend on the hour of
  // delivery, and would need a timezone this system has not chosen.
  if (now.getTime() > deadline.getTime()) {
    return {
      eligible: false,
      reason: `The ${windowDays}-day return window for this order closed on ${deadline
        .toISOString()
        .slice(0, 10)}.`,
    };
  }

  return { eligible: true, deadline };
}
