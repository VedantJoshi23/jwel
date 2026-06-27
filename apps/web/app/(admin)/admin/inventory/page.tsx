'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/lib/auth-store';
import { adjustStock, listLowStock } from '@/lib/api/admin-inventory';
import type { InventoryItem } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

export default function AdminInventoryPage() {
  const token = useAuthStore((state) => state.token);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [error, setError] = useState('');
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    if (!token) return;
    listLowStock(token)
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load inventory'));
  }, [token]);

  useEffect(load, [load]);

  async function handleAdjust(variantId: string) {
    if (!token) return;
    const delta = Number(adjustments[variantId]);
    if (!Number.isFinite(delta) || delta === 0) return;
    try {
      await adjustStock(token, variantId, delta);
      setAdjustments((prev) => ({ ...prev, [variantId]: '' }));
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to adjust stock');
    }
  }

  return (
    <div>
      <h1 className="mb-2 font-display text-3xl font-bold">Inventory</h1>
      <p className="mb-6 text-sm text-ink-muted">
        SKUs at or below their low-stock threshold (FR-18). Variant names aren&apos;t available from this
        endpoint — shown by variant id; cross-reference with the Products page if needed.
      </p>

      {error && <p className="mb-4 text-sm text-feedback-error">{error}</p>}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-muted">
                <th className="px-4 py-3">Variant</th>
                <th className="px-4 py-3">On hand</th>
                <th className="px-4 py-3">Reserved</th>
                <th className="px-4 py-3">Available</th>
                <th className="px-4 py-3">Threshold</th>
                <th className="px-4 py-3">Adjust</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.variantId} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{item.variantId.slice(0, 8)}…</td>
                  <td className="px-4 py-3">{item.quantityOnHand}</td>
                  <td className="px-4 py-3">{item.quantityReserved}</td>
                  <td className="px-4 py-3 font-medium">{item.quantityOnHand - item.quantityReserved}</td>
                  <td className="px-4 py-3 text-ink-secondary">{item.lowStockThreshold}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="±qty"
                        className="h-9 w-20"
                        value={adjustments[item.variantId] ?? ''}
                        onChange={(e) =>
                          setAdjustments((prev) => ({ ...prev, [item.variantId]: e.target.value }))
                        }
                      />
                      <Button size="s" variant="secondary" onClick={() => handleAdjust(item.variantId)}>
                        Apply
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-ink-muted">
                    Nothing below its low-stock threshold right now.
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
