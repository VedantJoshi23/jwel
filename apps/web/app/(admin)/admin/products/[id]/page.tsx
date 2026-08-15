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
import type { Product, ProductMedia } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

// Photo (and, since FEAT-PRODUCT-VIDEO-MEDIA, short video) management — this
// is the first admin UI for `ProductMedia` at all (see the Storage/S3 gap
// closed alongside this page). Editing name/price/variants is a separate,
// larger piece of admin UI not attempted here.

// Matches FEAT-PRODUCT-VIDEO-MEDIA §9 — a soft, client-side-only guard. The
// server does not enforce duration (no ffprobe dependency exists); this
// exists to give the admin fast feedback rather than an upload that succeeds
// and then looks wrong on the storefront.
const MAX_VIDEO_DURATION_SECONDS = 30;

function readVideoDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Could not read video metadata'));
    };
    video.src = URL.createObjectURL(file);
  });
}

/**
 * A video can never become the thumbnail (FEAT-PRODUCT-VIDEO-MEDIA §5). A
 * `handleMove` swap exchanges `media[index]` and `media[target]`; whichever
 * of the two ends up at position 0 is the one that matters, and that can be
 * either side of the swap depending on which end of it is index 0.
 */
function moveWouldPutVideoAtThumbnail(media: ProductMedia[], index: number, direction: -1 | 1): boolean {
  const target = index + direction;
  if (target < 0 || target >= media.length) return false;
  if (target === 0 && media[index].type === 'VIDEO') return true;
  if (index === 0 && media[target].type === 'VIDEO') return true;
  return false;
}
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

    for (const file of fileArray) {
      if (!file.type.startsWith('video/')) continue;
      try {
        const duration = await readVideoDurationSeconds(file);
        if (duration > MAX_VIDEO_DURATION_SECONDS) {
          setError(
            `"${file.name}" is ${Math.round(duration)}s long — videos must be ${MAX_VIDEO_DURATION_SECONDS}s or shorter`,
          );
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
      } catch {
        // Duration couldn't be read client-side (unsupported codec, etc.) —
        // let the server's mime/size checks be the actual gate rather than
        // blocking the upload on a client-only signal that failed to read.
      }
    }

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
    if (moveWouldPutVideoAtThumbnail(media, index, direction)) return;
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
            isDraggingOver ? 'border-brand-ink bg-brand-ink/10' : 'border-transparent',
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFilesSelected(e.target.files);
            }}
          />
          <Button onClick={() => fileInputRef.current?.click()} loading={uploadProgress !== null}>
            {uploadProgress ? `Uploading ${uploadProgress.done} of ${uploadProgress.total}…` : 'Upload photos or video'}
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
                    {media.type === 'VIDEO' ? (
                      <>
                        <video src={media.url} muted preload="metadata" className="h-full w-full object-cover" />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white">
                            ▶
                          </span>
                        </div>
                        <Badge variant="default" className="absolute left-2 top-2">
                          Video
                        </Badge>
                      </>
                    ) : (
                      <>
                        <Image src={media.url} alt="" fill sizes="25vw" className="object-cover" />
                        {index === 0 && (
                          <Badge variant="accent" className="absolute left-2 top-2">
                            Thumbnail
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex gap-1">
                      <Button
                        size="s"
                        variant="ghost"
                        disabled={index === 0 || moveWouldPutVideoAtThumbnail(product.media, index, -1)}
                        onClick={() => handleMove(index, -1)}
                        aria-label="Move earlier"
                      >
                        ↑
                      </Button>
                      <Button
                        size="s"
                        variant="ghost"
                        disabled={
                          index === product.media.length - 1 || moveWouldPutVideoAtThumbnail(product.media, index, 1)
                        }
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
                  {index !== 0 && media.type !== 'VIDEO' && (
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
