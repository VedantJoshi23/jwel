'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useAuthStore } from '@/lib/auth-store';
import {
  adminCreateCollection,
  adminDeleteCollection,
  adminListCollections,
  adminUpdateCollection,
} from '@/lib/api/admin-collections';
import { adminListProducts } from '@/lib/api/admin-products';
import { ImageUploadField } from '@/components/admin/image-upload-field';
import type { AdminCollection, CollectionType, Product } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';
import { TableScroll } from '@/components/admin/table-scroll';

const COLLECTION_TYPES: { value: CollectionType; label: string }[] = [
  { value: 'SEASONAL', label: 'Seasonal drop' },
  { value: 'EDITORIAL', label: 'Editorial / lookbook' },
  { value: 'GOLD', label: 'Gold' },
  { value: 'DIAMOND', label: 'Diamond' },
];

const EMPTY_FORM = {
  name: '',
  slug: '',
  type: 'SEASONAL' as CollectionType,
  description: '',
  heroImageRef: '',
  heroImageUrl: '',
  startsAt: '',
  endsAt: '',
  isFeatured: false,
  productIds: [] as string[],
};

/** `datetime-local` gives "2026-11-01T09:00"; the API wants a full ISO string. */
function toIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** The inverse — pre-filling an edit form's `datetime-local` input from a stored ISO string. */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const EMPTY_EDIT_FORM = {
  name: '',
  slug: '',
  type: 'SEASONAL' as CollectionType,
  description: '',
  heroImageRef: '',
  heroImageUrl: '',
  startsAt: '',
  endsAt: '',
  isFeatured: false,
};
type EditFormState = typeof EMPTY_EDIT_FORM;

function scheduleLabel(collection: AdminCollection): string {
  const from = collection.startsAt ? new Date(collection.startsAt).toLocaleDateString() : null;
  const to = collection.endsAt ? new Date(collection.endsAt).toLocaleDateString() : null;
  if (!from && !to) return 'Always live';
  if (from && to) return `${from} → ${to}`;
  return from ? `From ${from}` : `Until ${to}`;
}

export default function AdminCollectionsPage() {
  const token = useAuthStore((state) => state.token);
  const [collections, setCollections] = useState<AdminCollection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Inline edit — same shape as CMS Banners' editingId pattern. Deliberately
  // has no product picker: `adminList` returns only `_count.products`, never
  // the member ids, so there is no way to pre-fill a picker with the actual
  // current selection. Submitting `productIds: undefined` on save leaves
  // membership untouched, the same convention `handleToggleFeatured` below
  // already relies on.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(EMPTY_EDIT_FORM);

  const load = useCallback(() => {
    if (!token) return;
    adminListCollections(token)
      .then(setCollections)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load collections'));
  }, [token]);

  useEffect(load, [load]);

  // The picker offers everything an admin could curate, published or not — a
  // collection is often assembled before its pieces go live.
  useEffect(() => {
    if (!token) return;
    adminListProducts(token, { pageSize: 100 })
      .then((result) => setProducts(result.items))
      .catch(() => setProducts([]));
  }, [token]);

  function toggleProduct(productId: string) {
    setForm((f) => ({
      ...f,
      productIds: f.productIds.includes(productId)
        ? f.productIds.filter((id) => id !== productId)
        : [...f.productIds, productId],
    }));
  }

  async function handleCreate() {
    if (!token || !form.name.trim()) return;
    setBusy(true);
    setError('');
    try {
      await adminCreateCollection(token, {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        type: form.type,
        description: form.description.trim() || undefined,
        heroImageRef: form.heroImageRef || undefined,
        isFeatured: form.isFeatured,
        startsAt: toIso(form.startsAt),
        endsAt: toIso(form.endsAt),
        // Order of selection becomes the display order — the API assigns
        // sortOrder by array index.
        productIds: form.productIds.length > 0 ? form.productIds : undefined,
      });
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      // The slug-collision guard reports through here, and its message names
      // the conflicting category or collection — surface it verbatim rather
      // than replacing it with a generic failure string.
      setError(err instanceof ApiError ? err.message : 'Failed to create collection');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleFeatured(collection: AdminCollection) {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      await adminUpdateCollection(token, collection.id, {
        name: collection.name,
        type: collection.type,
        description: collection.description ?? undefined,
        heroImageRef: collection.heroImageRef ?? undefined,
        isFeatured: !collection.isFeatured,
        startsAt: collection.startsAt ?? undefined,
        endsAt: collection.endsAt ?? undefined,
      });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update collection');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(collection: AdminCollection) {
    setEditingId(collection.id);
    setEditForm({
      name: collection.name,
      slug: collection.slug,
      type: collection.type,
      description: collection.description ?? '',
      heroImageRef: collection.heroImageRef ?? '',
      heroImageUrl: collection.heroImageUrl ?? '',
      startsAt: toDatetimeLocal(collection.startsAt),
      endsAt: toDatetimeLocal(collection.endsAt),
      isFeatured: collection.isFeatured,
    });
    setError('');
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleSaveEdit(id: string) {
    if (!token || !editForm.name.trim()) return;
    setBusy(true);
    setError('');
    try {
      await adminUpdateCollection(token, id, {
        name: editForm.name.trim(),
        slug: editForm.slug.trim() || undefined,
        type: editForm.type,
        description: editForm.description.trim() || undefined,
        heroImageRef: editForm.heroImageRef || undefined,
        isFeatured: editForm.isFeatured,
        startsAt: toIso(editForm.startsAt),
        endsAt: toIso(editForm.endsAt),
        // productIds intentionally omitted — see the state comment above.
      });
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update collection');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(collection: AdminCollection) {
    if (!token) return;
    if (!window.confirm(`Delete collection "${collection.name}"? This can't be undone.`)) return;
    setBusy(true);
    setError('');
    try {
      await adminDeleteCollection(token, collection.id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete collection');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Collections</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Curated sets that cut across categories — a seasonal drop or an editorial lookbook. A category is
          what a piece <em>is</em> (rings, earrings); a collection is a grouping you choose. Slug is generated
          from the name when left blank, and cannot match an existing category.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-sm bg-feedback-error/10 px-3 py-2 text-sm text-feedback-error">
          {error}
        </p>
      )}

      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold">Add a collection</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="col-name">
                Name
              </label>
              <Input
                id="col-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="col-slug">
                Slug (optional)
              </label>
              <Input
                id="col-slug"
                placeholder="diwali-edit"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="col-type">
                Type
              </label>
              <Select
                id="col-type"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CollectionType }))}
              >
                {COLLECTION_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="col-description">
                Description (optional)
              </label>
              <Input
                id="col-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="col-starts">
                Goes live (optional)
              </label>
              <Input
                id="col-starts"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="col-ends">
                Ends (optional)
              </label>
              <Input
                id="col-ends"
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
              />
            </div>
          </div>

          <ImageUploadField
            label="Hero image (optional)"
            folder="collections"
            token={token}
            value={form.heroImageRef || null}
            previewUrl={form.heroImageUrl || null}
            onChange={(storageRef, previewUrl) =>
              setForm((f) => ({ ...f, heroImageRef: storageRef ?? '', heroImageUrl: previewUrl ?? '' }))
            }
            disabled={busy}
          />

          <fieldset>
            <legend className="mb-1 text-xs font-medium">
              Products {form.productIds.length > 0 && `(${form.productIds.length} selected)`}
            </legend>
            {products.length === 0 ? (
              <p className="text-xs text-ink-muted">No products available to add.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-sm border border-border p-2">
                {products.map((product) => (
                  <label key={product.id} className="flex items-center gap-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={form.productIds.includes(product.id)}
                      onChange={() => toggleProduct(product.id)}
                    />
                    <span>{product.name}</span>
                    {product.status !== 'PUBLISHED' && (
                      // Selectable but flagged: the public collection page
                      // lists published products only, so an unpublished
                      // pick simply won't appear to shoppers yet.
                      <span className="text-xs text-ink-muted">({product.status.toLowerCase()})</span>
                    )}
                  </label>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-ink-muted">
              The order you tick them in is the order they appear in the collection.
            </p>
          </fieldset>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
            />
            Featured
          </label>

          <p className="text-xs text-ink-muted">
            Leave the dates blank for a collection that is live as soon as it is created. A collection with a
            future start date stays hidden from shoppers until then.
          </p>

          <Button onClick={handleCreate} disabled={busy || !form.name.trim()}>
            Add collection
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="mb-3 text-sm font-semibold">Existing collections</h2>
          {collections.length === 0 ? (
            <p className="text-sm text-ink-muted">No collections yet.</p>
          ) : (
            <TableScroll label="Existing collections">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-ink-secondary">
                    <tr className="border-b border-border">
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Slug</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Products</th>
                      <th className="px-4 py-2">Schedule</th>
                      <th className="px-4 py-2">Featured</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {collections.map((collection) =>
                      editingId === collection.id ? (
                        <tr key={collection.id} className="border-b border-border last:border-0">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="space-y-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <label
                                    className="mb-1 block text-xs font-medium"
                                    htmlFor={`col-edit-name-${collection.id}`}
                                  >
                                    Name
                                  </label>
                                  <Input
                                    id={`col-edit-name-${collection.id}`}
                                    value={editForm.name}
                                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label
                                    className="mb-1 block text-xs font-medium"
                                    htmlFor={`col-edit-slug-${collection.id}`}
                                  >
                                    Slug
                                  </label>
                                  <Input
                                    id={`col-edit-slug-${collection.id}`}
                                    value={editForm.slug}
                                    onChange={(e) => setEditForm((f) => ({ ...f, slug: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label
                                    className="mb-1 block text-xs font-medium"
                                    htmlFor={`col-edit-type-${collection.id}`}
                                  >
                                    Type
                                  </label>
                                  <Select
                                    id={`col-edit-type-${collection.id}`}
                                    value={editForm.type}
                                    onChange={(e) =>
                                      setEditForm((f) => ({ ...f, type: e.target.value as CollectionType }))
                                    }
                                  >
                                    {COLLECTION_TYPES.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </Select>
                                </div>
                                <div>
                                  <label
                                    className="mb-1 block text-xs font-medium"
                                    htmlFor={`col-edit-description-${collection.id}`}
                                  >
                                    Description (optional)
                                  </label>
                                  <Input
                                    id={`col-edit-description-${collection.id}`}
                                    value={editForm.description}
                                    onChange={(e) =>
                                      setEditForm((f) => ({ ...f, description: e.target.value }))
                                    }
                                  />
                                </div>
                                <div>
                                  <label
                                    className="mb-1 block text-xs font-medium"
                                    htmlFor={`col-edit-starts-${collection.id}`}
                                  >
                                    Goes live (optional)
                                  </label>
                                  <Input
                                    id={`col-edit-starts-${collection.id}`}
                                    type="datetime-local"
                                    value={editForm.startsAt}
                                    onChange={(e) => setEditForm((f) => ({ ...f, startsAt: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label
                                    className="mb-1 block text-xs font-medium"
                                    htmlFor={`col-edit-ends-${collection.id}`}
                                  >
                                    Ends (optional)
                                  </label>
                                  <Input
                                    id={`col-edit-ends-${collection.id}`}
                                    type="datetime-local"
                                    value={editForm.endsAt}
                                    onChange={(e) => setEditForm((f) => ({ ...f, endsAt: e.target.value }))}
                                  />
                                </div>
                              </div>

                              <ImageUploadField
                                label="Hero image (optional)"
                                folder="collections"
                                token={token}
                                value={editForm.heroImageRef || null}
                                previewUrl={editForm.heroImageUrl || null}
                                onChange={(storageRef, previewUrl) =>
                                  setEditForm((f) => ({
                                    ...f,
                                    heroImageRef: storageRef ?? '',
                                    heroImageUrl: previewUrl ?? '',
                                  }))
                                }
                                disabled={busy}
                              />

                              <p className="text-xs text-ink-muted">
                                Products aren&rsquo;t editable here — this list doesn&rsquo;t carry current
                                membership, only a count, so there&rsquo;s no safe way to pre-fill a picker.
                                Saving leaves the collection&rsquo;s products unchanged.
                              </p>

                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={editForm.isFeatured}
                                  onChange={(e) =>
                                    setEditForm((f) => ({ ...f, isFeatured: e.target.checked }))
                                  }
                                />
                                Featured
                              </label>

                              <div className="flex gap-2">
                                <Button
                                  size="s"
                                  onClick={() => handleSaveEdit(collection.id)}
                                  loading={busy}
                                  disabled={!editForm.name.trim()}
                                >
                                  Save
                                </Button>
                                <Button size="s" variant="secondary" onClick={cancelEdit}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={collection.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3 font-medium">{collection.name}</td>
                          <td className="px-4 py-3 font-mono text-xs text-ink-secondary">/{collection.slug}</td>
                          <td className="px-4 py-3">{collection.type}</td>
                          <td className="px-4 py-3">{collection._count?.products ?? 0}</td>
                          <td className="px-4 py-3 text-xs">{scheduleLabel(collection)}</td>
                          <td className="px-4 py-3">
                            <Button
                              variant="ghost"
                              size="s"
                              disabled={busy}
                              onClick={() => handleToggleFeatured(collection)}
                            >
                              {collection.isFeatured ? 'Yes' : 'No'}
                            </Button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="s"
                                disabled={busy}
                                onClick={() => startEdit(collection)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="s"
                                disabled={busy}
                                onClick={() => handleDelete(collection)}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
            </TableScroll>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
