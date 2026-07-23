'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [busyMediaId, setBusyMediaId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    if (!token) return;
    adminGetProduct(token, id)
      .then(setProduct)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load product'));
  }, [token, id]);

  useEffect(load, [load]);

  async function handleFilesSelected(files: FileList | File[]) {
    if (!token) return;
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setError('');
    setUploadProgress({ done: 0, total: fileArray.length });
    try {
      // Sequential, not parallel: the server computes each photo's position
      // as the current photo count, so concurrent uploads would race and
      // could land two photos at the same position.
      for (let i = 0; i < fileArray.length; i++) {
        const updated = await adminUploadProductMedia(token, id, fileArray[i]);
        setProduct(updated);
        setUploadProgress({ done: i + 1, total: fileArray.length });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setUploadProgress(null);
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

  async function handleMakeThumbnail(mediaId: string) {
    if (!token || !product) return;
    const reordered = [mediaId, ...product.media.filter((m) => m.id !== mediaId).map((m) => m.id)];

    setError('');
    try {
      const updated = await adminReorderProductMedia(token, id, reordered);
      setProduct(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to set thumbnail');
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
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingOver(false);
            if (e.dataTransfer.files.length > 0) handleFilesSelected(e.dataTransfer.files);
          }}
          className={cn(
            'rounded-s border-2 border-dashed p-2 transition-colors',
            isDraggingOver ? 'border-brand-primary bg-brand-primary/5' : 'border-transparent',
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFilesSelected(e.target.files);
            }}
          />
          <Button onClick={() => fileInputRef.current?.click()} loading={uploadProgress !== null}>
            {uploadProgress ? `Uploading ${uploadProgress.done} of ${uploadProgress.total}…` : 'Upload photos'}
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
                    {index === 0 && (
                      <Badge variant="accent" className="absolute left-2 top-2">
                        Thumbnail
                      </Badge>
                    )}
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
                  {index !== 0 && (
                    <Button size="s" variant="secondary" className="w-full" onClick={() => handleMakeThumbnail(media.id)}>
                      Make thumbnail
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
