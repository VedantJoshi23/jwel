'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/auth-store';
import {
  adminGetProduct,
  adminRemoveProductMedia,
  adminReorderProductMedia,
  adminUploadProductMedia,
} from '@/lib/api/admin-products';
import type { Product } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

// Photo management only — this is the first admin UI for `ProductMedia` at
// all (see the Storage/S3 gap closed alongside this page). Editing name/
// price/variants is a separate, larger piece of admin UI not attempted here.
export default function AdminProductMediaPage() {
  const { id } = useParams<{ id: string }>();
  const token = useAuthStore((state) => state.token);
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [busyMediaId, setBusyMediaId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    if (!token) return;
    adminGetProduct(token, id)
      .then(setProduct)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load product'));
  }, [token, id]);

  useEffect(load, [load]);

  async function handleFileSelected(file: File) {
    if (!token) return;
    setUploading(true);
    setError('');
    try {
      const updated = await adminUploadProductMedia(token, id, file);
      setProduct(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemove(mediaId: string) {
    if (!token) return;
    setBusyMediaId(mediaId);
    setError('');
    try {
      const updated = await adminRemoveProductMedia(token, id, mediaId);
      setProduct(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove photo');
    } finally {
      setBusyMediaId(null);
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    if (!token || !product) return;
    const media = [...product.media];
    const target = index + direction;
    if (target < 0 || target >= media.length) return;
    [media[index], media[target]] = [media[target], media[index]];

    setError('');
    try {
      const updated = await adminReorderProductMedia(
        token,
        id,
        media.map((m) => m.id),
      );
      setProduct(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reorder photos');
    }
  }

  if (!product) {
    return <p className="text-sm text-ink-secondary">{error || 'Loading…'}</p>;
  }

  return (
    <div>
      <Link href="/admin/products" className="text-sm text-ink-secondary hover:underline">
        ← Back to products
      </Link>
      <div className="mb-6 mt-2 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">{product.name}</h1>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelected(file);
            }}
          />
          <Button onClick={() => fileInputRef.current?.click()} loading={uploading}>
            Upload photo
          </Button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-feedback-error">{error}</p>}

      <Card>
        <CardContent>
          {product.media.length === 0 ? (
            <p className="py-8 text-center text-ink-muted">No photos yet — upload one above.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {product.media.map((media, index) => (
                <div key={media.id} className="space-y-2">
                  <div className="relative aspect-square overflow-hidden rounded-s border border-border bg-surface-alt">
                    <Image src={media.url} alt="" fill sizes="25vw" className="object-cover" />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex gap-1">
                      <Button
                        size="s"
                        variant="ghost"
                        disabled={index === 0}
                        onClick={() => handleMove(index, -1)}
                        aria-label="Move earlier"
                      >
                        ↑
                      </Button>
                      <Button
                        size="s"
                        variant="ghost"
                        disabled={index === product.media.length - 1}
                        onClick={() => handleMove(index, 1)}
                        aria-label="Move later"
                      >
                        ↓
                      </Button>
                    </div>
                    <Button
                      size="s"
                      variant="destructive"
                      loading={busyMediaId === media.id}
                      onClick={() => handleRemove(media.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
