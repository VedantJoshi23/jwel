export interface TopProduct {
  productId: string;
  name: string;
  unitsSold: number;
  revenueMinorUnits: number;
}

export interface DashboardSummary {
  windowDays: number;
  revenueMinorUnits: number;
  orderCount: number;
  averageOrderValueMinorUnits: number;
  ordersByStatus: Record<string, number>;
  topProducts: TopProduct[];
  lowStockCount: number;
  pendingReviewsCount: number;
  newCustomers: number;
}
