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

// Keys match the real client taxonomy's four main categories (see
// `brand.ts`'s `productTypes`/`subcategories`) plus the pre-existing
// curated-view slugs (`all`, `new-arrivals`, `bestsellers`,
// `temple-jewelry`) that aren't real `Category` rows.
// `jhumkas`/`necklace-sets`/`bangles`/`choker-sets` were the old,
// partly-invented top-level slugs — kept here (not deleted) only because
// `getCategoryBannerImage`'s fallback makes a missing key harmless, and a
// sub-category filter UI may want per-sub-category imagery later.
export const categoryImages: Record<string, string> = {
  jhumkas: '/images/jewellery/category-jhumkas.jpg',
  'necklace-sets': '/images/jewellery/category-necklace-sets.jpg',
  bangles: '/images/jewellery/category-bangles.jpg',
  earrings: '/images/jewellery/category-jhumkas.jpg',
  rings: '/images/jewellery/bestseller-ring.jpg',
  necklaces: '/images/jewellery/bestseller-necklace.jpg',
  'necklaces-and-pendants': '/images/jewellery/bestseller-necklace.jpg',
  'bracelets-and-bangles': '/images/jewellery/newarrival-bracelet.jpg',
  'temple-jewelry': '/images/jewellery/hero-model.jpg',
  'choker-sets': '/images/jewellery/newarrival-pearl.jpg',
  all: '/images/jewellery/hero-model.jpg',
  'new-arrivals': '/images/jewellery/newarrival-pearl.jpg',
  bestsellers: '/images/jewellery/bestseller-necklace.jpg',
};

/** Collection/PLP banner image for a category or curated-view slug, with a sane fallback. */
export function getCategoryBannerImage(slug: string): string {
  return categoryImages[slug] ?? heroImage;
}

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

/**
 * Home page category-trio tile photography — a *different* stopgap from the
 * Pexels stock above, not an extension of it. The trio's tiles were
 * deliberately left as plain colour ("Stock lifestyle photography removed —
 * a plain tile until real category photography exists", still the comment
 * at that call site) rather than backed by this file's stock pool at all.
 *
 * These three are client-supplied AI-generated reference images, approved
 * for this specific use per `ADR-0026` — cropped to the photography only
 * (the composite's own baked-in "Rings"/"Earrings"/… title text is
 * discarded; the tile renders the real category name as ordinary HTML
 * beside the crop, same relationship the removed placeholder comment
 * describes). A fourth crop, `bracelets-and-bangles.webp`, is exported
 * alongside these three for the same source/settings consistency, but is
 * deliberately not listed below — `brand.homeCategories` has only three
 * entries today, and adding a featured category is a catalogue decision,
 * not an imagery one (see `ADR-0026`'s Revisit Criteria).
 * `getHomeCategoryTileImage` returns `null` for anything not mapped here
 * rather than silently reusing one of these three for an unrelated
 * category, which would be its own small Law 1 problem.
 *
 * Revisit per `ADR-0026`: delete this block and its three files under
 * `public/images/categories/` once real category photography exists —
 * do not keep it as a fallback layered under real photos.
 */
const homeCategoryTileImages: Record<string, string> = {
  rings: '/images/categories/rings.webp',
  earrings: '/images/categories/earrings.webp',
  'necklaces-and-pendants': '/images/categories/necklaces-and-pendants.webp',
};

export function getHomeCategoryTileImage(slug: string): string | null {
  return homeCategoryTileImages[slug] ?? null;
}
