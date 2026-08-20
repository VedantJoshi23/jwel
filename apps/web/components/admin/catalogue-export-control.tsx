'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useAuthStore } from '@/lib/auth-store';
import { adminDownloadCataloguePdf, adminListCategories, type CatalogueExportScope } from '@/lib/api/admin-products';
import { adminListCollections } from '@/lib/api/admin-collections';
import type { Category, AdminCollection } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

type ScopeKind = 'all' | 'category' | 'collection';

// FEAT-CATALOGUE-EXPORT — an admin picks whole catalogue, one category, or
// one collection, and gets back a downloadable PDF. Draft products never
// appear in any scope (enforced server-side; nothing to duplicate here).
export function CatalogueExportControl() {
  const token = useAuthStore((state) => state.token);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<AdminCollection[]>([]);
  const [scopeKind, setScopeKind] = useState<ScopeKind>('all');
  const [categoryId, setCategoryId] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    adminListCategories(token).then(setCategories).catch(() => {});
    adminListCollections(token).then(setCollections).catch(() => {});
  }, [token]);

  async function handleDownload() {
    if (!token) return;
    setError('');
    setDownloading(true);
    try {
      const scope: CatalogueExportScope =
        scopeKind === 'category' && categoryId
          ? { categoryId }
          : scopeKind === 'collection' && collectionId
            ? { collectionId }
            : {};
      await adminDownloadCataloguePdf(token, scope);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate the catalogue PDF');
    } finally {
      setDownloading(false);
    }
  }

  const disabled = (scopeKind === 'category' && !categoryId) || (scopeKind === 'collection' && !collectionId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label="Catalogue PDF scope"
        value={scopeKind}
        onChange={(e) => setScopeKind(e.target.value as ScopeKind)}
        className="!h-9 !w-auto"
      >
        <option value="all">Whole catalogue</option>
        <option value="category">One category…</option>
        <option value="collection">One collection…</option>
      </Select>
      {scopeKind === 'category' && (
        <Select
          aria-label="Category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="!h-9 !w-auto"
        >
          <option value="">Choose a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      )}
      {scopeKind === 'collection' && (
        <Select
          aria-label="Collection"
          value={collectionId}
          onChange={(e) => setCollectionId(e.target.value)}
          className="!h-9 !w-auto"
        >
          <option value="">Choose a collection</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      )}
      <Button variant="secondary" size="s" loading={downloading} disabled={disabled} onClick={handleDownload}>
        Download catalogue (PDF)
      </Button>
      {error && <p className="text-sm text-feedback-error">{error}</p>}
    </div>
  );
}
