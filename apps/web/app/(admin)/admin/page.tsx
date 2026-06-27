'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/lib/auth-store';
import { getDashboardSummary } from '@/lib/api/admin-analytics';
import { formatMinorUnits } from '@/lib/money';
import type { DashboardSummary } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-sm text-ink-muted">{label}</p>
        <p className="mt-1 font-display text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const token = useAuthStore((state) => state.token);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState('');
  const [windowDays, setWindowDays] = useState(30);

  useEffect(() => {
    if (!token) return;
    getDashboardSummary(token, windowDays)
      .then(setSummary)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load dashboard'));
  }, [token, windowDays]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Reports &amp; Analytics</h1>
        <select
          value={windowDays}
          onChange={(e) => setWindowDays(Number(e.target.value))}
          className="h-9 rounded-s border border-border bg-surface px-2 text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {error && <p className="text-sm text-feedback-error">{error}</p>}
      {!summary && !error && <p className="text-sm text-ink-muted">Loading…</p>}

      {summary && (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Revenue" value={formatMinorUnits(summary.revenueMinorUnits)} />
            <StatCard label="Orders" value={String(summary.orderCount)} />
            <StatCard label="Avg. order value" value={formatMinorUnits(summary.averageOrderValueMinorUnits)} />
            <StatCard label="New customers" value={String(summary.newCustomers)} />
            <StatCard label="Low stock SKUs" value={String(summary.lowStockCount)} />
            <StatCard label="Pending reviews" value={String(summary.pendingReviewsCount)} />
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 font-display text-xl font-bold">Orders by status</h2>
              <Card>
                <CardContent className="space-y-2">
                  {Object.entries(summary.ordersByStatus).map(([status, count]) => (
                    <div key={status} className="flex justify-between text-sm">
                      <span className="text-ink-secondary">{status}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                  {Object.keys(summary.ordersByStatus).length === 0 && (
                    <p className="text-sm text-ink-muted">No orders in this window.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div>
              <h2 className="mb-3 font-display text-xl font-bold">Top products</h2>
              <Card>
                <CardContent className="space-y-2">
                  {summary.topProducts.map((p) => (
                    <div key={p.productId} className="flex justify-between text-sm">
                      <span className="text-ink-secondary">
                        {p.name} <span className="text-ink-muted">×{p.unitsSold}</span>
                      </span>
                      <span className="font-medium">{formatMinorUnits(p.revenueMinorUnits)}</span>
                    </div>
                  ))}
                  {summary.topProducts.length === 0 && (
                    <p className="text-sm text-ink-muted">No sales in this window.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
