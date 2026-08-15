'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { ProductMedia } from '@/lib/api/types';
import { getProductStockImage } from '@/lib/jewellery-images';
import { ProductZoomModal } from './product-zoom-modal';

interface ProductGalleryProps {
  media: ProductMedia[];
  productId: string;
  productName: string;
}

export function ProductGallery({ media, productId, productName }: ProductGalleryProps) {
  // FEAT-PRODUCT-VIDEO-MEDIA: media now includes VIDEO items, no longer
  // filtered out. FEAT-PRODUCT-VIDEO-MEDIA §5 guarantees the first item
  // (sortOrder 0) is always an IMAGE, so `items[0]` below is always safe to
  // treat as the product's thumbnail.
  const items = [...media].sort((a, b) => a.sortOrder - b.sortOrder);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const activeItem = items[selectedIndex];

  return (
    <div>
      <div className="relative aspect-square overflow-hidden bg-surface-alt">
        {activeItem?.type === 'VIDEO' ? (
          <video
            key={activeItem.id}
            src={activeItem.url}
            controls
            muted
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            aria-label="Open full-screen view to zoom in"
            className="group absolute inset-0 h-full w-full cursor-zoom-in"
          >
            <Image
              src={activeItem?.url ?? getProductStockImage(productId)}
              alt={productName}
              fill
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
            <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
              +
            </span>
          </button>
        )}
      </div>

      {items.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedIndex(index)}
              aria-label={
                item.type === 'VIDEO' ? `Play video ${index + 1} of ${items.length}` : `Show image ${index + 1} of ${items.length}`
              }
              aria-current={index === selectedIndex}
              className={cn(
                'relative h-16 w-16 shrink-0 overflow-hidden rounded-m border-2 bg-surface-alt',
                index === selectedIndex ? 'border-brand-ink' : 'border-border',
              )}
            >
              {item.type === 'VIDEO' ? (
                <>
                  <video src={item.url} muted preload="metadata" className="h-full w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-xs text-white">▶</span>
                </>
              ) : (
                <Image src={item.url} alt="" fill sizes="64px" className="object-cover" />
              )}
            </button>
          ))}
        </div>
      )}

      <ProductZoomModal
        media={items}
        productName={productName}
        open={zoomOpen}
        index={selectedIndex}
        onClose={() => setZoomOpen(false)}
        onIndexChange={setSelectedIndex}
      />
    </div>
  );
}
