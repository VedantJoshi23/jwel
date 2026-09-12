import { describe, expect, it } from 'vitest';
import { getHomeCategoryTileImage } from './jewellery-images';

describe('getHomeCategoryTileImage', () => {
  it.each(['rings', 'earrings', 'necklaces-and-pendants'])(
    'returns the approved crop for %s',
    (slug) => {
      expect(getHomeCategoryTileImage(slug)).toBe(`/images/categories/${slug}.webp`);
    },
  );

  it('returns null for a category with no approved crop, rather than reusing an unrelated one', () => {
    // ADR-0026: only three categories have approved photography. A category
    // this set doesn't cover (bracelets-and-bangles, or anything future)
    // must fall back to the plain tile, not silently borrow a mismatched photo.
    expect(getHomeCategoryTileImage('bracelets-and-bangles')).toBeNull();
    expect(getHomeCategoryTileImage('no-such-category')).toBeNull();
  });
});
