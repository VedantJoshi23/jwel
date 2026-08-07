import { BadRequestException } from '@nestjs/common';
import { assertPublishable, checkPublishable, PublishCandidate } from './publish-validation';

/**
 * FEAT-PUBLISH-COMPLETENESS §7 — every edge case has a test, per
 * STD-TESTING r6.
 */
describe('publish-validation', () => {
  const good = (over: Partial<PublishCandidate> = {}): PublishCandidate => ({
    name: 'Dazzle Band Silver Ring',
    description: 'A studded band in 92.5 sterling silver, rhodium plated.',
    mediaCount: 1,
    sizeScheme: 'RING_INDIA',
    variants: [{ sku: 'SKU-1', basePriceMinorUnits: 249900, size: '16' }],
    ...over,
  });

  it('passes a complete product', () => {
    expect(checkPublishable(good())).toEqual({ blockers: [], warnings: [] });
  });

  describe('the placeholder catalogue this feature exists for', () => {
    /**
     * These are the LITERAL strings `scripts/seed-draft-products-from-uploads.ts`
     * writes, and the 1,045 rows in production carry them verbatim. If that
     * generator's wording changes and `publish-validation.ts` does not, the
     * gate fails open and publishes exactly what it exists to stop — so this
     * test is what pins the two together.
     */
    const GENERATED_NAME = 'Untitled Draft 1041';
    const GENERATED_DESCRIPTION =
      'Pending — placeholder draft created from an uploaded image. Edit before publishing.';

    it('refuses a generated draft outright', () => {
      const { blockers } = checkPublishable(
        good({
          name: GENERATED_NAME,
          description: GENERATED_DESCRIPTION,
          variants: [{ sku: 'DRAFT-abc', basePriceMinorUnits: 0, size: null }],
          mediaCount: 1,
        }),
      );

      // Name, description, price and size — all four, in one refusal.
      expect(blockers).toHaveLength(4);
    });

    it('catches the generated name even with a real description', () => {
      const { blockers } = checkPublishable(good({ name: GENERATED_NAME }));
      expect(blockers).toEqual([expect.stringContaining('generated placeholder')]);
    });

    it('catches the generated description even with a real name', () => {
      const { blockers } = checkPublishable(good({ description: GENERATED_DESCRIPTION }));
      expect(blockers).toEqual([expect.stringContaining('placeholder text')]);
    });

    it('is not fooled by a mere presence check', () => {
      // The point of the whole exercise: every draft HAS a name and HAS a
      // description, so "not empty" would let all 1,045 through.
      const draft = good({ name: GENERATED_NAME, description: GENERATED_DESCRIPTION });
      expect(draft.name.trim()).not.toBe('');
      expect(draft.description.trim()).not.toBe('');
      expect(checkPublishable(draft).blockers.length).toBeGreaterThan(0);
    });

    it('matches the placeholder name case-insensitively and with a different number', () => {
      expect(checkPublishable(good({ name: 'untitled draft 7' })).blockers).toHaveLength(1);
      expect(checkPublishable(good({ name: 'UNTITLED DRAFT 999' })).blockers).toHaveLength(1);
    });

    it('does not reject a legitimate name that merely contains the word draft', () => {
      // "Draftsman Signet Ring" is a real product name, not a placeholder.
      expect(checkPublishable(good({ name: 'Draftsman Signet Ring' })).blockers).toEqual([]);
    });
  });

  describe('hard blocks — silent failures', () => {
    it('blocks a zero price', () => {
      const { blockers } = checkPublishable(
        good({ variants: [{ sku: 'SKU-1', basePriceMinorUnits: 0, size: '16' }] }),
      );
      expect(blockers).toEqual([expect.stringContaining('no price')]);
    });

    it('blocks a negative price', () => {
      const { blockers } = checkPublishable(
        good({ variants: [{ sku: 'SKU-1', basePriceMinorUnits: -1, size: '16' }] }),
      );
      expect(blockers).toHaveLength(1);
    });

    it('blocks a missing size in a sized category', () => {
      const { blockers } = checkPublishable(
        good({ variants: [{ sku: 'SKU-1', basePriceMinorUnits: 100, size: null }] }),
      );
      expect(blockers).toEqual([expect.stringContaining('no size')]);
    });

    it('does NOT require a size in an unsized category', () => {
      // An earring has no size dimension; demanding one would contradict
      // FEAT-SIZE-TAXONOMY.
      const { blockers } = checkPublishable(
        good({
          sizeScheme: null,
          variants: [{ sku: 'SKU-1', basePriceMinorUnits: 100, size: null }],
        }),
      );
      expect(blockers).toEqual([]);
    });

    it('blocks a product with no variants', () => {
      const { blockers } = checkPublishable(good({ variants: [] }));
      expect(blockers).toEqual([expect.stringContaining('At least one variant')]);
    });

    it('treats a whitespace-only description as absent (§7.7)', () => {
      const { blockers } = checkPublishable(good({ description: '   ' }));
      expect(blockers).toEqual([expect.stringContaining('Description is required')]);
    });

    it('treats a whitespace-only name as absent', () => {
      const { blockers } = checkPublishable(good({ name: '  ' }));
      expect(blockers).toEqual([expect.stringContaining('Name is required')]);
    });

    it('reports every blocker, not just the first (§3.7)', () => {
      const { blockers } = checkPublishable(
        good({
          name: '',
          description: '',
          variants: [
            { sku: 'A', basePriceMinorUnits: 0, size: null },
            { sku: 'B', basePriceMinorUnits: 0, size: null },
          ],
        }),
      );
      // name + description + 2 variants x (price + size)
      expect(blockers).toHaveLength(6);
      expect(blockers.join(' ')).toContain('"A"');
      expect(blockers.join(' ')).toContain('"B"');
    });
  });

  describe('warnings — visible failures', () => {
    it('warns on no images but does not block', () => {
      const { blockers, warnings } = checkPublishable(good({ mediaCount: 0 }));
      expect(blockers).toEqual([]);
      expect(warnings).toEqual([expect.stringContaining('no images')]);
    });

    it('does not warn when an image is present', () => {
      expect(checkPublishable(good({ mediaCount: 2 })).warnings).toEqual([]);
    });
  });

  describe('assertPublishable', () => {
    it('returns warnings when publishable', () => {
      expect(assertPublishable(good({ mediaCount: 0 }))).toEqual([
        expect.stringContaining('no images'),
      ]);
    });

    it('returns an empty array for a clean product', () => {
      expect(assertPublishable(good())).toEqual([]);
    });

    it('throws listing every blocker', () => {
      expect(() => assertPublishable(good({ name: '', description: '' }))).toThrow(
        BadRequestException,
      );
      expect(() => assertPublishable(good({ name: '', description: '' }))).toThrow(
        /Name is required.*Description is required/s,
      );
    });

    it('names the product in the refusal where it has one', () => {
      expect(() => assertPublishable(good({ description: '' }))).toThrow(/Dazzle Band Silver Ring/);
    });

    it('falls back gracefully when the product has no name to quote', () => {
      expect(() => assertPublishable(good({ name: '' }))).toThrow(/this product/);
    });
  });
});
