/**
 * DEMO PHOTOGRAPHY LAYER — not the real asset pipeline.
 *
 * `Product.media[].storageRef` (see lib/api/types.ts) is how real product
 * photography will eventually reach the frontend once the Storage module is
 * wired up (ARCHITECTURE.md §3, FRONTEND.md §4 — currently unimplemented).
 * Until then, this file maps categories/products to free-to-use stock
 * photography (Pexels License — free for commercial use, no attribution
 * required) so client-facing previews aren't a wall of "[ placeholder ]"
 * boxes. Delete this file once real photography/storageRef URLs exist —
 * every call site falls back to it only when `media` is empty.
 */

export const heroImage = '/images/jewellery/hero-model.jpg';
export const macroSparkleImage = '/images/jewellery/macro-sparkle.jpg';

export const categoryImages: Record<string, string> = {
  jhumkas: '/images/jewellery/category-jhumkas.jpg',
  'necklace-sets': '/images/jewellery/category-necklace-sets.jpg',
  bangles: '/images/jewellery/category-bangles.jpg',
};

const productImagePool = [
  '/images/jewellery/bestseller-necklace.jpg',
  '/images/jewellery/bestseller-ring.jpg',
  '/images/jewellery/newarrival-pearl.jpg',
  '/images/jewellery/newarrival-bracelet.jpg',
  '/images/jewellery/newarrival-ring.jpg',
];

/** Deterministic per-product fallback image — same product always gets the same photo. */
export function getProductStockImage(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return productImagePool[hash % productImagePool.length];
}
