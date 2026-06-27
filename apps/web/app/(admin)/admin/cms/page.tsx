'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/lib/auth-store';
import { adminCreateBanner, adminDeleteBanner, adminListBanners } from '@/lib/api/admin-cms';
import type { Banner } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

const EMPTY_FORM = { title: '', imageRef: '', linkUrl: '', sortOrder: '0' };

export default function AdminCmsPage() {
  const token = useAuthStore((state) => state.token);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

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
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Input
              placeholder="Title"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <Input
              placeholder="Image ref (storage path)"
              required
              value={form.imageRef}
              onChange={(e) => setForm((f) => ({ ...f, imageRef: e.target.value }))}
            />
            <Input
              placeholder="Link URL (optional)"
              value={form.linkUrl}
              onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
            />
            <Input
              type="number"
              placeholder="Sort order"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            />
            <Button type="submit" loading={creating} className="col-span-2 lg:col-span-1">
              Create
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
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
              {banners.map((banner) => (
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
                    <Button size="s" variant="destructive" onClick={() => handleDelete(banner.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {banners.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                    No banners yet.
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
