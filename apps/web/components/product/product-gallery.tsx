'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { ProductMedia } from '@/lib/api/types';
import { getProductStockImage } from '@/lib/jewellery-images';

interface ProductGalleryProps {
  media: ProductMedia[];
  productId: string;
  productName: string;
}

export function ProductGallery({ media, productId, productName }: ProductGalleryProps) {
  const images = [...media]
    .filter((item) => item.type === 'IMAGE')
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeImage = images[selectedIndex];

  return (
    <div>
      <div className="relative aspect-square overflow-hidden bg-surface-alt">
        <Image
          src={activeImage?.url ?? getProductStockImage(productId)}
          alt={productName}
          fill
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
      </div>

      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setSelectedIndex(index)}
              aria-label={`Show image ${index + 1} of ${images.length}`}
              aria-current={index === selectedIndex}
              className={cn(
                'relative h-16 w-16 shrink-0 overflow-hidden rounded-m border-2 bg-surface-alt',
                index === selectedIndex ? 'border-brand-primary' : 'border-border',
              )}
            >
              <Image src={image.url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
