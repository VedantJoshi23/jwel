import { describe, expect, it } from 'vitest';
import { getHomeCategoryTileImage } from './jewellery-images';
import { brand } from './brand';

describe('getHomeCategoryTileImage', () => {
  it.each(['rings', 'earrings', 'necklaces-and-pendants', 'bracelets-and-bangles'])(
    'returns the approved crop for %s',
    (slug) => {
      expect(getHomeCategoryTileImage(slug)).toBe(`/images/categories/${slug}.webp`);
    },
  );

  it('covers every category the home page actually renders a tile for', () => {
    // The tile falls back to a plain colour block when this returns null, so
    // a category added to `homeCategories` without a crop degrades quietly
    // into one blank tile in an otherwise photographic row.
    for (const category of brand.homeCategories) {
      expect(getHomeCategoryTileImage(category.slug)).not.toBeNull();
    }
  });

  it('returns null for a category with no approved crop, rather than reusing an unrelated one', () => {
    // ADR-0026: only the four categories in the client's composite have
    // approved photography. Anything else must fall back to the plain tile,
    // not silently borrow a mismatched photo.
    expect(getHomeCategoryTileImage('anklets')).toBeNull();
    expect(getHomeCategoryTileImage('no-such-category')).toBeNull();
  });
});
