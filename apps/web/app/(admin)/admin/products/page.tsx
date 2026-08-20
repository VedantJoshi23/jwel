'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/common/pagination';
import { CatalogueExportControl } from '@/components/admin/catalogue-export-control';
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
  const [publishWarnings, setPublishWarnings] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [showImportHelp, setShowImportHelp] = useState(false);
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
    setError('');
    setPublishWarnings([]);
    try {
      // FEAT-PUBLISH-COMPLETENESS: a publish can succeed *and* have something
      // worth saying. A warning nobody sees is not a warning, so the response
      // is read rather than discarded. Refusals arrive as a 400 and land in
      // `error` via the catch below, carrying every blocker in one message.
      const updated = await adminUpdateProductStatus(token, product.id, status);
      if (updated.publishWarnings?.length) {
        setPublishWarnings(updated.publishWarnings);
      }
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
          <Button variant="ghost" size="s" onClick={() => setShowImportHelp((v) => !v)}>
            {showImportHelp ? 'Hide CSV format' : 'CSV format?'}
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-s border border-border bg-surface-alt px-4 py-3">
        <p className="text-sm text-ink-secondary">Send the catalogue to someone outside the platform</p>
        <CatalogueExportControl />
      </div>

      {/* FEAT-BULK-IMPORT §5 — the schema, in the admin's own words. Kept
          collapsed by default so it doesn't compete with the product table
          on every visit; an admin who already knows the format never needs
          to see it. */}
      {showImportHelp && (
        <Card className="mb-6">
          <CardContent className="space-y-3 text-sm">
            <p>
              <a
                href="/templates/product-bulk-import-template.csv"
                download
                className="font-medium text-ink-primary underline-offset-2 hover:underline"
              >
                Download a template CSV
              </a>{' '}
              — the header row plus one example, ready to fill in.{' '}
              <span className="text-ink-secondary">
                Its example category (&ldquo;rings&rdquo;) may not exist in this store — replace{' '}
                <code className="rounded bg-surface px-1">category_slug</code> with a real category&rsquo;s slug.
              </span>
            </p>
            <div>
              <p className="font-medium">Required columns — a blank value rejects that row</p>
              <p className="mt-1 text-ink-secondary">
                <code className="rounded bg-surface px-1">name</code>,{' '}
                <code className="rounded bg-surface px-1">slug</code>,{' '}
                <code className="rounded bg-surface px-1">category_slug</code> (must match an existing category),{' '}
                <code className="rounded bg-surface px-1">description</code>,{' '}
                <code className="rounded bg-surface px-1">sku</code> (must be unique),{' '}
                <code className="rounded bg-surface px-1">metal</code> (GOLD, GOLD_PLATED, SILVER, PLATINUM, or
                STAINLESS_STEEL), <code className="rounded bg-surface px-1">weight_grams</code>, and{' '}
                <code className="rounded bg-surface px-1">base_price_minor_units</code> (the price in paise — ₹899 is{' '}
                <code className="rounded bg-surface px-1">89900</code>).
              </p>
            </div>
            <div>
              <p className="font-medium">Optional columns — blank is fine</p>
              <p className="mt-1 text-ink-secondary">
                <code className="rounded bg-surface px-1">certification_type</code> (BIS_HALLMARK, IGI, GIA, SGL, or
                HKD — if given, must be valid),{' '}
                <code className="rounded bg-surface px-1">certification_doc_ref</code>,{' '}
                <code className="rounded bg-surface px-1">purity</code>, and{' '}
                <code className="rounded bg-surface px-1">size</code> (if given, must be a valid size for that
                category).
              </p>
            </div>
            <p className="text-ink-secondary">
              One row makes one product with exactly one variant — there&rsquo;s no way to import several sizes of the
              same design in one row. A bad row doesn&rsquo;t stop the rest of the file; you&rsquo;ll get a per-row
              result after uploading. Every imported product starts as a draft, same as creating one by hand.
            </p>
          </CardContent>
        </Card>
      )}

      {error && <p className="mb-4 text-sm text-feedback-error">{error}</p>}

      {publishWarnings.length > 0 && (
        <div className="mb-4 rounded-s border border-border-warm bg-surface-alt p-3">
          <p className="text-sm font-medium">Published, with warnings</p>
          <ul className="mt-1 space-y-1 text-sm text-ink-secondary">
            {publishWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

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
                <th className="px-4 py-3 text-right">Actions</th>
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
                    <div className="flex items-center justify-end gap-4">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="text-sm text-ink-secondary underline-offset-2 hover:underline"
                        >
                          Photos ({product.media.length})
                        </Link>
                        <Link
                          href={`/admin/products/${product.id}/edit`}
                          className="text-sm text-ink-secondary underline-offset-2 hover:underline"
                        >
                          Edit
                        </Link>
                      </div>
                      <div className="w-[92px] shrink-0 border-l border-border pl-4">
                        {product.status === 'DRAFT' && (
                          <Button
                            size="s"
                            variant="secondary"
                            className="w-full"
                            onClick={() => handleStatusChange(product, 'PUBLISHED')}
                          >
                            Publish
                          </Button>
                        )}
                        {product.status === 'PUBLISHED' && (
                          <Button
                            size="s"
                            variant="secondary"
                            className="w-full"
                            onClick={() => handleStatusChange(product, 'ARCHIVED')}
                          >
                            Archive
                          </Button>
                        )}
                      </div>
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
