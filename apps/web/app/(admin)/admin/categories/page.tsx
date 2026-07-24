'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/lib/auth-store';
import { adminListCategories } from '@/lib/api/admin-products';
import {
  adminCreateCategory,
  adminDeleteCategory,
  adminUpdateCategory,
} from '@/lib/api/admin-categories';
import type { Category } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

const selectClassName =
  'w-full rounded-s border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent';

// A product must belong to a leaf category (see product-form.tsx), so the
// parent picker offers only categories that could serve as a grouping — any
// existing category except the one being edited (to avoid self-parenting;
// deeper cycles are rejected by the API).
function parentOptions(categories: Category[], excludeId?: string): Category[] {
  return categories.filter((c) => c.id !== excludeId);
}

function categoryLabel(category: Category, categories: Category[]): string {
  if (!category.parentId) return category.name;
  const parent = categories.find((c) => c.id === category.parentId);
  return parent ? `${parent.name} — ${category.name}` : category.name;
}

export default function AdminCategoriesPage() {
  const token = useAuthStore((state) => state.token);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Create form
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newParentId, setNewParentId] = useState('');

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editParentId, setEditParentId] = useState('');

  const load = useCallback(() => {
    if (!token) return;
    adminListCategories(token)
      .then(setCategories)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load categories'));
  }, [token]);

  useEffect(load, [load]);

  async function handleCreate() {
    if (!token || !newName.trim()) return;
    setBusy(true);
    setError('');
    try {
      await adminCreateCategory(token, {
        name: newName.trim(),
        slug: newSlug.trim() || undefined,
        parentId: newParentId || null,
      });
      setNewName('');
      setNewSlug('');
      setNewParentId('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create category');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setEditName(category.name);
    setEditSlug(category.slug);
    setEditParentId(category.parentId ?? '');
    setError('');
  }

  async function handleSaveEdit(id: string) {
    if (!token || !editName.trim()) return;
    setBusy(true);
    setError('');
    try {
      await adminUpdateCategory(token, id, {
        name: editName.trim(),
        slug: editSlug.trim() || undefined,
        parentId: editParentId || null,
      });
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update category');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(category: Category) {
    if (!token) return;
    if (!window.confirm(`Delete category "${category.name}"? This can't be undone.`)) return;
    setBusy(true);
    setError('');
    try {
      await adminDeleteCategory(token, category.id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete category');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Categories</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Manage the categories products can be assigned to. Slug is auto-generated from the name when left blank.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-s bg-feedback-error/10 px-3 py-2 text-sm text-feedback-error">
          {error}
        </p>
      )}

      {/* Create */}
      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold">Add a category</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="cat-name">
                Name
              </label>
              <Input
                id="cat-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Necklaces"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="cat-slug">
                Slug (optional)
              </label>
              <Input
                id="cat-slug"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="necklaces"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="cat-parent">
                Parent (optional)
              </label>
              <select
                id="cat-parent"
                className={selectClassName}
                value={newParentId}
                onChange={(e) => setNewParentId(e.target.value)}
              >
                <option value="">— Top level —</option>
                {parentOptions(categories).map((c) => (
                  <option key={c.id} value={c.id}>
                    {categoryLabel(c, categories)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button onClick={handleCreate} loading={busy} disabled={!newName.trim()}>
            Add category
          </Button>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardContent className="space-y-2">
          <h2 className="text-sm font-semibold">Existing categories</h2>
          {categories.length === 0 && <p className="text-sm text-ink-secondary">No categories yet.</p>}
          <ul className="divide-y divide-border">
            {categories.map((category) => (
              <li key={category.id} className="py-3">
                {editingId === category.id ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
                    <Input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} placeholder="Slug" />
                    <select
                      className={selectClassName}
                      value={editParentId}
                      onChange={(e) => setEditParentId(e.target.value)}
                    >
                      <option value="">— Top level —</option>
                      {parentOptions(categories, category.id).map((c) => (
                        <option key={c.id} value={c.id}>
                          {categoryLabel(c, categories)}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2 sm:col-span-3">
                      <Button size="s" onClick={() => handleSaveEdit(category.id)} loading={busy}>
                        Save
                      </Button>
                      <Button size="s" variant="secondary" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{categoryLabel(category, categories)}</p>
                      <p className="text-xs text-ink-secondary">/{category.slug}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="s" variant="secondary" onClick={() => startEdit(category)}>
                        Edit
                      </Button>
                      <Button size="s" variant="destructive" onClick={() => handleDelete(category)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
