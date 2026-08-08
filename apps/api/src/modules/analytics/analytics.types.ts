export interface TopProduct {
  productId: string;
  name: string;
  /** Units that left the shelf, not units kept — see getTopProducts. */
  unitsSold: number;
  grossMinorUnits: number;
  refundsMinorUnits: number;
  /** What this product actually contributed. Ranking is on this. */
  netMinorUnits: number;
}

export interface DashboardSummary {
  windowDays: number;
  /**
   * DOM-REPORTING invariant 4 — three figures, never one. `revenueMinorUnits`
   * used to be reported alone and was gross, so a month in which half the
   * goods came back read exactly like a month in which none did.
   */
  grossMinorUnits: number;
  refundsMinorUnits: number;
  netMinorUnits: number;
  orderCount: number;
  averageOrderValueMinorUnits: number;
  ordersByStatus: Record<string, number>;
  topProducts: TopProduct[];
  lowStockCount: number;
  pendingReviewsCount: number;
  newCustomers: number;
}
