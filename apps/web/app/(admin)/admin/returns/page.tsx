'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/auth-store';
import { adminListReturns, adminUpdateReturnStatus } from '@/lib/api/admin-returns';
import { formatMinorUnits } from '@/lib/money';
import type { AdminReturn, ReturnStatus } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

// Mirrors ReturnsService's ALLOWED_TRANSITIONS (apps/api) exactly — this page
// only ever offers a transition the backend will actually accept, so a click
// here can fail on a race (someone else moved it first) but never on a
// transition this UI itself considers valid.
const TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  REQUESTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['REFUND_PROCESSING'],
  REJECTED: [],
  REFUND_PROCESSING: ['REFUNDED'],
  REFUNDED: [],
};

const STATUS_VARIANT: Record<ReturnStatus, 'success' | 'warning' | 'error' | 'default'> = {
  REQUESTED: 'default',
  APPROVED: 'warning',
  REJECTED: 'error',
  REFUND_PROCESSING: 'warning',
  REFUNDED: 'success',
};

export default function AdminReturnsPage() {
  const token = useAuthStore((state) => state.token);
  const [returns, setReturns] = useState<AdminReturn[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | ''>('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  // Keyed by return id — only the row moving to REFUND_PROCESSING -> REFUNDED
  // shows an amount field, so most rows never touch this state.
  const [refundAmounts, setRefundAmounts] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    if (!token) return;
    adminListReturns(token, statusFilter || undefined)
      .then(setReturns)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load returns'));
  }, [token, statusFilter]);

  useEffect(load, [load]);

  // The single source of truth for "what amount does this row currently
  // show" — used for both the input's `value` and the amount actually
  // submitted, so the two can never drift apart (see handleTransition).
  function refundAmountValue(ret: AdminReturn): string {
    return refundAmounts[ret.id] ?? String(ret.orderItem.unitPriceMinorUnits / 100);
  }

  async function handleTransition(ret: AdminReturn, next: ReturnStatus) {
    if (!token) return;

    let refundAmountMinorUnits: number | undefined;
    if (next === 'REFUNDED') {
      // Rupees in the input, paise over the wire — same convention as every
      // other price field (lib/money.ts's comment on DATABASE.md §1).
      //
      // MUST read through the same fallback the input displays (see
      // refundAmountValue below), not refundAmounts[ret.id] directly. An
      // admin who never touches the pre-filled field never fires its
      // onChange, so refundAmounts[ret.id] stays undefined even though the
      // input visibly shows a number — reading it directly here silently
      // blocked every refund where the admin trusted the pre-fill and clicked
      // straight through. Caught by an actual browser run, not by the unit
      // tests, which always simulated typing before clicking.
      const rupees = parseFloat(refundAmountValue(ret));
      if (!Number.isFinite(rupees) || rupees < 0) {
        setError('Enter a valid refund amount before confirming the refund.');
        return;
      }
      refundAmountMinorUnits = Math.round(rupees * 100);
    }

    setBusyId(ret.id);
    setError('');
    try {
      // This is the transition that calls Razorpay's real Refunds API
      // (PaymentsService.refundForOrder) — a real gateway call, not a status
      // flip, which is why the button below says so explicitly rather than
      // just "Refund".
      await adminUpdateReturnStatus(token, ret.id, next, refundAmountMinorUnits);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update return status');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Returns</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ReturnStatus | '')}
          className="h-10 rounded-s border border-border bg-surface px-3 text-sm"
        >
          <option value="">All statuses</option>
          {(['REQUESTED', 'APPROVED', 'REFUND_PROCESSING', 'REFUNDED', 'REJECTED'] as const).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mb-4 text-sm text-feedback-error">{error}</p>}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-muted">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Item price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((ret) => {
                const nextOptions = TRANSITIONS[ret.status];
                const needsAmount = nextOptions.includes('REFUNDED');

                return (
                  <tr key={ret.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      {ret.orderItem.productNameSnapshot}
                      <div className="text-xs text-ink-muted">Qty {ret.orderItem.quantity}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{ret.orderItem.order.user.email}</td>
                    <td className="px-4 py-3">
                      {ret.reason}
                      {ret.notes && <div className="text-xs text-ink-muted">{ret.notes}</div>}
                    </td>
                    <td className="px-4 py-3">{formatMinorUnits(ret.orderItem.unitPriceMinorUnits)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[ret.status]}>{ret.status}</Badge>
                      {ret.status === 'REFUNDED' && ret.refundAmountMinorUnits !== null && (
                        <div className="mt-1 text-xs text-ink-muted">
                          {formatMinorUnits(ret.refundAmountMinorUnits)} refunded
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {nextOptions.length === 0 && <span className="text-xs text-ink-muted">final state</span>}

                      {needsAmount ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="₹ amount"
                            className="h-9 w-28"
                            value={refundAmountValue(ret)}
                            onChange={(e) =>
                              setRefundAmounts((prev) => ({ ...prev, [ret.id]: e.target.value }))
                            }
                          />
                          <Button
                            size="s"
                            loading={busyId === ret.id}
                            onClick={() => handleTransition(ret, 'REFUNDED')}
                          >
                            Refund via Razorpay
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          {nextOptions.map((next) => (
                            <button
                              key={next}
                              disabled={busyId === ret.id}
                              onClick={() => handleTransition(ret, next)}
                              className="rounded-s border border-border px-2 py-1 text-xs hover:bg-surface-alt disabled:opacity-50"
                            >
                              {next}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {returns.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-ink-muted">
                    No return requests{statusFilter ? ` with status ${statusFilter}` : ''}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
