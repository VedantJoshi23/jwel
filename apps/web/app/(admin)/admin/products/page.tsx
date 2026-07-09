'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/auth-store';
import { adminListProducts, adminUpdateProductStatus, bulkImportProducts } from '@/lib/api/admin-products';
import { formatMinorUnits } from '@/lib/money';
import type { BulkImportResult, Product } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

const STATUS_VARIANT: Record<Product['status'], 'success' | 'warning' | 'default'> = {
  PUBLISHED: 'success',
  DRAFT: 'warning',
  ARCHIVED: 'default',
};

export default function AdminProductsPage() {
  const token = useAuthStore((state) => state.token);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    if (!token) return;
    adminListProducts(token, { pageSize: 50 })
      .then((res) => setProducts(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load products'));
  }, [token]);

  useEffect(load, [load]);

  async function handleStatusChange(product: Product, status: Product['status']) {
    if (!token) return;
    try {
      await adminUpdateProductStatus(token, product.id, status);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update status');
    }
  }

  async function handleFileSelected(file: File) {
    if (!token) return;
    setImporting(true);
    setImportResult(null);
    setError('');
    try {
      const result = await bulkImportProducts(token, file);
      setImportResult(result);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Bulk import failed');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Products</h1>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelected(file);
            }}
          />
          <Button onClick={() => fileInputRef.current?.click()} loading={importing}>
            Bulk import (CSV)
          </Button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-feedback-error">{error}</p>}

      {importResult && (
        <Card className="mb-6">
          <CardContent>
            <p className="text-sm font-medium">
              Imported {importResult.succeeded}/{importResult.totalRows} rows successfully
              {importResult.failed > 0 && ` — ${importResult.failed} failed`}
            </p>
            {importResult.errors.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-feedback-error">
                {importResult.errors.map((e) => (
                  <li key={e.row}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-muted">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{product.name}</td>
                  <td className="px-4 py-3 text-ink-secondary">{product.category.name}</td>
                  <td className="px-4 py-3">
                    {product.variants.length > 0
                      ? formatMinorUnits(Math.min(...product.variants.map((v) => v.basePriceMinorUnits)))
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[product.status]}>{product.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link href={`/admin/products/${product.id}`} className="text-sm text-ink-secondary underline">
                        Photos ({product.media.length})
                      </Link>
                      {product.status === 'DRAFT' && (
                        <Button size="s" variant="secondary" onClick={() => handleStatusChange(product, 'PUBLISHED')}>
                          Publish
                        </Button>
                      )}
                      {product.status === 'PUBLISHED' && (
                        <Button size="s" variant="secondary" onClick={() => handleStatusChange(product, 'ARCHIVED')}>
                          Archive
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                    No products yet.
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
