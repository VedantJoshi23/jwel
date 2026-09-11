'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/lib/auth-store';
import { adminCreateBanner, adminDeleteBanner, adminListBanners, adminUpdateBanner } from '@/lib/api/admin-cms';
import { ImageUploadField } from '@/components/admin/image-upload-field';
import type { Banner } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';
import { TableScroll } from '@/components/admin/table-scroll';

const EMPTY_FORM = { title: '', imageRef: '', imageUrl: '', linkUrl: '', sortOrder: '0' };

const EMPTY_EDIT_FORM = {
  title: '',
  imageRef: '',
  imageUrl: '',
  linkUrl: '',
  sortOrder: '0',
  isActive: true,
  startsAt: '',
  endsAt: '',
};
type EditFormState = typeof EMPTY_EDIT_FORM;

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

export default function AdminCmsPage() {
  const token = useAuthStore((state) => state.token);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  // Inline edit — same shape as Categories' editingId pattern, expanded to a
  // full row since a banner carries more fields than fit a single cell.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(EMPTY_EDIT_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    adminListBanners(token)
      .then(setBanners)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load banners'));
  }, [token]);

  useEffect(load, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setCreating(true);
    setError('');
    try {
      await adminCreateBanner(token, {
        title: form.title,
        imageRef: form.imageRef,
        linkUrl: form.linkUrl || undefined,
        sortOrder: Number(form.sortOrder) || 0,
      });
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create banner');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(banner: Banner) {
    setEditingId(banner.id);
    setEditForm({
      title: banner.title,
      imageRef: banner.imageRef,
      imageUrl: '',
      linkUrl: banner.linkUrl ?? '',
      sortOrder: String(banner.sortOrder),
      isActive: banner.isActive,
      startsAt: toDatetimeLocal(banner.startsAt),
      endsAt: toDatetimeLocal(banner.endsAt),
    });
    setError('');
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleSaveEdit(id: string) {
    if (!token || !editForm.title.trim() || !editForm.imageRef) return;
    setSaving(true);
    setError('');
    try {
      await adminUpdateBanner(token, id, {
        title: editForm.title.trim(),
        imageRef: editForm.imageRef,
        linkUrl: editForm.linkUrl || undefined,
        sortOrder: Number(editForm.sortOrder) || 0,
        isActive: editForm.isActive,
        startsAt: toIso(editForm.startsAt),
        endsAt: toIso(editForm.endsAt),
      });
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update banner');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    if (!confirm('Delete this banner?')) return;
    try {
      await adminDeleteBanner(token, id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete banner');
    }
  }

  return (
    <div>
      <h1 className="mb-2 font-display text-3xl font-bold">CMS — Homepage Banners</h1>
      <p className="mb-6 text-sm text-ink-muted">
        FR-23&apos;s full scope (category landing content, lookbook/editorial pages) isn&apos;t implemented —
        this covers homepage banners only.
      </p>
      {error && <p className="mb-4 text-sm text-feedback-error">{error}</p>}

      <Card className="mb-8">
        <CardContent>
          <h2 className="mb-4 font-display text-lg font-bold">New banner</h2>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <Input
              placeholder="Title"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <Input
              placeholder="Link URL — /collections/rings or https://…"
              value={form.linkUrl}
              onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
            />
            <Input
              type="number"
              placeholder="Sort order"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            />
            <div className="sm:col-span-2">
              <ImageUploadField
                label="Banner image"
                folder="banners"
                token={token}
                value={form.imageRef || null}
                previewUrl={form.imageUrl || null}
                onChange={(storageRef, previewUrl) =>
                  setForm((f) => ({ ...f, imageRef: storageRef ?? '', imageUrl: previewUrl ?? '' }))
                }
                disabled={creating}
              />
            </div>
            <Button
              type="submit"
              loading={creating}
              // The API requires imageRef; without an upload there is nothing
              // to submit, and a 400 is a worse way to learn that.
              disabled={!form.imageRef}
              className="sm:col-span-2"
            >
              Create
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <TableScroll label="Homepage banners">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Image ref</th>
                  <th className="px-4 py-3">Sort</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {banners.map((banner) =>
                  editingId === banner.id ? (
                    <tr key={banner.id} className="border-b border-border last:border-0">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-medium" htmlFor={`banner-title-${banner.id}`}>
                                Title
                              </label>
                              <Input
                                id={`banner-title-${banner.id}`}
                                value={editForm.title}
                                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium" htmlFor={`banner-link-${banner.id}`}>
                                Link URL
                              </label>
                              <Input
                                id={`banner-link-${banner.id}`}
                                placeholder="/collections/rings or https://…"
                                value={editForm.linkUrl}
                                onChange={(e) => setEditForm((f) => ({ ...f, linkUrl: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium" htmlFor={`banner-sort-${banner.id}`}>
                                Sort order
                              </label>
                              <Input
                                id={`banner-sort-${banner.id}`}
                                type="number"
                                value={editForm.sortOrder}
                                onChange={(e) => setEditForm((f) => ({ ...f, sortOrder: e.target.value }))}
                              />
                            </div>
                            <label className="mt-6 flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={editForm.isActive}
                                onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                              />
                              Active
                            </label>
                            <div>
                              <label className="mb-1 block text-xs font-medium" htmlFor={`banner-starts-${banner.id}`}>
                                Goes live (optional)
                              </label>
                              <Input
                                id={`banner-starts-${banner.id}`}
                                type="datetime-local"
                                value={editForm.startsAt}
                                onChange={(e) => setEditForm((f) => ({ ...f, startsAt: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium" htmlFor={`banner-ends-${banner.id}`}>
                                Ends (optional)
                              </label>
                              <Input
                                id={`banner-ends-${banner.id}`}
                                type="datetime-local"
                                value={editForm.endsAt}
                                onChange={(e) => setEditForm((f) => ({ ...f, endsAt: e.target.value }))}
                              />
                            </div>
                          </div>

                          <ImageUploadField
                            label="Banner image"
                            folder="banners"
                            token={token}
                            value={editForm.imageRef || null}
                            previewUrl={editForm.imageUrl || null}
                            onChange={(storageRef, previewUrl) =>
                              setEditForm((f) => ({ ...f, imageRef: storageRef ?? '', imageUrl: previewUrl ?? '' }))
                            }
                            disabled={saving}
                          />

                          <div className="flex gap-2">
                            <Button
                              size="s"
                              onClick={() => handleSaveEdit(banner.id)}
                              loading={saving}
                              disabled={!editForm.title.trim() || !editForm.imageRef}
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
                    <tr key={banner.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">{banner.title}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-secondary">{banner.imageRef}</td>
                      <td className="px-4 py-3">{banner.sortOrder}</td>
                      <td className="px-4 py-3">
                        <Badge variant={banner.isActive ? 'success' : 'default'}>
                          {banner.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button size="s" variant="secondary" onClick={() => startEdit(banner)}>
                            Edit
                          </Button>
                          <Button size="s" variant="destructive" onClick={() => handleDelete(banner.id)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
                {banners.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                      No banners yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableScroll>
        </CardContent>
      </Card>
    </div>
  );
}
