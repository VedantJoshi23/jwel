/**
 * `DOM-REPORTING` invariants 3 and 4 — what "revenue" means here.
 *
 * The dashboard reported **one** figure and called it Revenue. It was the sum
 * of non-cancelled order totals with **no refund deducted**, so a month in
 * which half the goods came back read exactly like a month in which none did.
 *
 * Invariant 3 deducts refunds; invariant 4 reports **three** figures rather
 * than one, because a single net number that fell last month is unexplainable
 * — the split says whether trade slowed or returns rose, and it costs one
 * extra aggregate.
 *
 * ```text
 * gross   = SUM(orders.total_minor_units)              status <> 'CANCELLED'
 * refunds = SUM(return_requests.refund_amount)         status  = 'REFUNDED'
 * net     = gross - refunds
 * ```
 *
 * **Partial refunds need no special case**, which is the point of deducting
 * from returns rather than branching on order status. A `DELIVERED` order with
 * one of three items refunded contributes its full total to `gross` and that
 * item's refund to `refunds`. A fully refunded order nets to approximately
 * zero without a branch, because every one of its items appears in `refunds`.
 *
 * Nothing is stored (`STD-DATABASE` r9). A stored revenue figure would be a
 * second source of truth for something `orders` and `return_requests` already
 * know — the same failure shape as `Product.avgRating` (KC-142).
 */

export interface RevenueFigures {
  /** Non-cancelled order totals. What was sold. */
  grossMinorUnits: number;
  /** Refunds actually paid out. Only `REFUNDED` returns count. */
  refundsMinorUnits: number;
  /**
   * `gross - refunds`.
   *
   * Labelled **"net of refunds"** rather than "revenue" wherever it is shown.
   * If a refund amount excludes shipping, a fully refunded order nets to the
   * shipping cost rather than zero — arguably correct, since the shipping was
   * incurred, but it reads as a rounding error unless the label says what the
   * number is (`DOM-REPORTING` §3).
   */
  netMinorUnits: number;
}

export function computeRevenue(
  grossMinorUnits: number,
  refundsMinorUnits: number,
): RevenueFigures {
  return {
    grossMinorUnits,
    refundsMinorUnits,
    // Deliberately not clamped at zero. A window whose refunds exceed its
    // gross is a real and alarming state, and hiding it behind a floor of 0
    // would be the dashboard lying to protect its own appearance.
    netMinorUnits: grossMinorUnits - refundsMinorUnits,
  };
}

/** Average order value, computed on **gross** — what a customer typically spends. */
export function averageOrderValue(grossMinorUnits: number, orderCount: number): number {
  return orderCount > 0 ? Math.round(grossMinorUnits / orderCount) : 0;
}
