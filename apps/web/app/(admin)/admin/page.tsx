'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { useAuthStore } from '@/lib/auth-store';
import { getDashboardSummary } from '@/lib/api/admin-analytics';
import { formatMinorUnits } from '@/lib/money';
import type { DashboardSummary } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

/**
 * `href` is optional — most stat cards report a number with nowhere to go
 * from it. "Pending reviews" is different: `FEAT-ADMIN-REVIEW-MODERATION`
 * gave it somewhere to go, and a count with no way to act on it is close to
 * the thing that made the count wrong for so long (a real page existed, but
 * every review submitted since launch stayed permanently PENDING because
 * nothing linked to it).
 */
function StatCard({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <CardContent>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href}>
        <Card className="transition-colors hover:border-brand-ink">{body}</Card>
      </Link>
    );
  }

  return <Card>{body}</Card>;
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
        {/*
          An accessible name, which this had none of — axe rates a nameless
          <select> critical, and with a screen reader it announces only its
          current value with no indication of what it controls.
        */}
        <label htmlFor="reporting-window" className="sr-only">
          Reporting window
        </label>
        <Select
          id="reporting-window"
          value={windowDays}
          onChange={(e) => setWindowDays(Number(e.target.value))}
          className="h-9 w-auto"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </Select>
      </div>

      {error && <p className="text-sm text-feedback-error">{error}</p>}
      {!summary && !error && <p className="text-sm text-ink-muted">Loading…</p>}

      {summary && (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {/*
              DOM-REPORTING invariant 4: three figures, never one. This card
              said "Revenue" and showed gross, so a month in which half the
              goods came back read exactly like a month in which none did.

              "Net of refunds" rather than "Revenue" is deliberate — if a
              refund excludes shipping, a fully refunded order nets to the
              shipping cost rather than zero, which reads as a rounding error
              unless the label says what the number is.
            */}
            <StatCard label="Gross sales" value={formatMinorUnits(summary.grossMinorUnits)} />
            <StatCard label="Refunds" value={formatMinorUnits(summary.refundsMinorUnits)} />
            <StatCard label="Net of refunds" value={formatMinorUnits(summary.netMinorUnits)} />
            <StatCard label="Orders" value={String(summary.orderCount)} />
            <StatCard label="Avg. order value" value={formatMinorUnits(summary.averageOrderValueMinorUnits)} />
            <StatCard label="New customers" value={String(summary.newCustomers)} />
            <StatCard label="Low stock SKUs" value={String(summary.lowStockCount)} />
            <StatCard
              label="Pending reviews"
              value={String(summary.pendingReviewsCount)}
              href="/admin/reviews"
            />
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
                      <span className="font-medium">
                        {formatMinorUnits(p.netMinorUnits)}
                        {p.refundsMinorUnits > 0 && (
                          <span className="ml-1 text-xs font-normal text-feedback-warning">
                            −{formatMinorUnits(p.refundsMinorUnits)} returned
                          </span>
                        )}
                      </span>
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
