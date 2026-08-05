'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/common/pagination';
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

// The API caps pageSize at 100 (PaginationQueryDto). 50 keeps the table
// scannable while halving the number of pages to work through.
const PAGE_SIZE = 50;

// useSearchParams() opts the subtree into client-side rendering, and Next
// requires a Suspense boundary around it or the build fails on this route.
// Same shape as app/(storefront)/login/page.tsx.
export default function AdminProductsPage() {
  return (
    <Suspense>
      <AdminProductsPageInner />
    </Suspense>
  );
}

function AdminProductsPageInner() {
  const token = useAuthStore((state) => state.token);
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Page lives in the URL, not local state, so a page is linkable and the
  // browser Back button steps through pages — which matters when working
  // through a thousand drafts across many sittings. A junk or out-of-range
  // ?page= falls back to 1 rather than requesting a negative offset.
  const parsedPage = Number(searchParams.get('page'));
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const load = useCallback(() => {
    if (!token) return;
    adminListProducts(token, { page, pageSize: PAGE_SIZE })
      .then((res) => {
        setProducts(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load products'));
  }, [token, page]);

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
        <div>
          <h1 className="font-display text-3xl font-bold">Products</h1>
          {total > 0 && (
            <p className="mt-1 text-sm text-ink-secondary">
              {total.toLocaleString()} product{total === 1 ? '' : 's'} · showing{' '}
              {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–
              {Math.min(page * PAGE_SIZE, total).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/products/new">
            <Button variant="secondary">New product</Button>
          </Link>
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
                      <Link href={`/admin/products/${product.id}/edit`} className="text-sm text-ink-secondary underline">
                        Edit
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

      {/* Renders nothing at one page, so a small catalogue is unaffected. */}
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        basePath="/admin/products"
        searchParams={{}}
      />
    </div>
  );
}
