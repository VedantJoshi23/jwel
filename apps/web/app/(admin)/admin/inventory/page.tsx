'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Pagination } from '@/components/common/pagination';
import { useAuthStore } from '@/lib/auth-store';
import { adjustStock, listInventory } from '@/lib/api/admin-inventory';
import type { AdminInventoryItem } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

const PAGE_SIZE = 24;

// useSearchParams() opts the subtree into client-side rendering, and Next
// requires a Suspense boundary around it or the build fails on this route.
// Same shape as admin/products/page.tsx.
export default function AdminInventoryPage() {
  return (
    <Suspense>
      <AdminInventoryPageInner />
    </Suspense>
  );
}

function AdminInventoryPageInner() {
  const token = useAuthStore((state) => state.token);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<AdminInventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});

  const parsedPage = Number(searchParams.get('page'));
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const q = searchParams.get('q') ?? '';
  const lowStockOnly = searchParams.get('lowStockOnly') === 'true';

  // Local, so typing doesn't refetch on every keystroke — only committed to
  // the URL (and so to the actual query) on submit.
  const [searchInput, setSearchInput] = useState(q);

  const load = useCallback(() => {
    if (!token) return;
    listInventory(token, { page, pageSize: PAGE_SIZE, q: q || undefined, lowStockOnly: lowStockOnly || undefined })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load inventory'));
  }, [token, page, q, lowStockOnly]);

  useEffect(load, [load]);

  function updateParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    // A filter change makes the current page number meaningless against the
    // new result set — restart at page 1 rather than risk landing past the
    // end of a much shorter filtered list.
    params.delete('page');
    router.push(`/admin/inventory?${params.toString()}`);
  }

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    updateParams({ q: searchInput || undefined });
  }

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
        Search by product name or SKU to find and adjust any item (FR-18) — not only ones already at or
        below their low-stock threshold.
      </p>

      <form onSubmit={handleSearchSubmit} className="mb-4 flex flex-wrap items-center gap-4">
        <Input
          placeholder="Search by product name or SKU"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-xs"
          aria-label="Search inventory by product name or SKU"
        />
        <Button type="submit" size="s" variant="secondary">
          Search
        </Button>
        <label className="flex items-center gap-2 text-sm text-ink-secondary">
          <Checkbox
            checked={lowStockOnly}
            onCheckedChange={(checked) => updateParams({ lowStockOnly: checked ? 'true' : undefined })}
          />
          Low stock only
        </label>
      </form>

      {error && <p className="mb-4 text-sm text-feedback-error">{error}</p>}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-muted">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
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
                  <td className="px-4 py-3 font-medium">{item.productName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-secondary">{item.sku}</td>
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
                        aria-label={`Adjust stock for ${item.productName}, SKU ${item.sku}`}
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
                  <td colSpan={7} className="px-4 py-6 text-center text-ink-muted">
                    {q || lowStockOnly ? 'No matching inventory.' : 'No inventory yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Renders nothing at one page, so a small catalogue is unaffected. */}
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        basePath="/admin/inventory"
        searchParams={{ q: q || undefined, lowStockOnly: lowStockOnly ? 'true' : undefined }}
      />
    </div>
  );
}
