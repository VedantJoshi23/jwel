'use client';

import Lightbox, { type Slide } from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import Video from 'yet-another-react-lightbox/plugins/video';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';
import type { ProductMedia } from '@/lib/api/types';

// FEAT-PRODUCT-ZOOM-VIEWER — a full-screen viewer so a design-sensitive
// purchase (jewellery) can be inspected closer than the inline gallery
// allows. Images are pinch/click-zoomable (the `Zoom` plugin); a video slide
// (FEAT-PRODUCT-VIDEO-MEDIA) plays with native controls and is not
// zoomable — §3 of that spec scopes zoom to images only, since the modal's
// first slide is always an image (a video can never be the thumbnail).
interface ProductZoomModalProps {
  media: ProductMedia[];
  productName: string;
  open: boolean;
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

function toSlide(item: ProductMedia, productName: string): Slide {
  if (item.type === 'VIDEO') {
    return {
      type: 'video',
      width: 1600,
      height: 1600,
      controls: true,
      muted: true,
      preload: 'metadata',
      sources: [{ src: item.url, type: 'video/mp4' }],
    };
  }
  return { type: 'image', src: item.url, alt: productName };
}

export function ProductZoomModal({ media, productName, open, index, onClose, onIndexChange }: ProductZoomModalProps) {
  const slides = media.map((item) => toSlide(item, productName));
  // FEAT-PRODUCT-ZOOM-VIEWER §7.1 — nothing to switch between with one item.
  const plugins = media.length > 1 ? [Zoom, Thumbnails, Video] : [Zoom, Video];

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index}
      slides={slides}
      on={{ view: ({ index: newIndex }) => onIndexChange(newIndex) }}
      plugins={plugins}
      zoom={{ maxZoomPixelRatio: 4, doubleTapDelay: 300, doubleClickDelay: 300, pinchZoomDistanceFactor: 100 }}
      thumbnails={{ position: 'bottom', border: 0, padding: 0, gap: 8, showToggle: false }}
      carousel={{ finite: true }}
      controller={{ closeOnBackdropClick: true }}
    />
  );
}
