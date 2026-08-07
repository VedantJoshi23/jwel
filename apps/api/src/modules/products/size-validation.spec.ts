import { BadRequestException } from '@nestjs/common';
import { SizeScheme } from '@prisma/client';
import { assertVariantSizes, resolveSchemeFromChain } from './size-validation';

/**
 * FEAT-SIZE-TAXONOMY §7 — every edge case has a test, per STD-TESTING r6.
 * These are decisions rather than queries, which is why the logic is pure
 * functions and testable without a Prisma mock.
 */
describe('size-validation', () => {
  const RING_SIZES = new Set(['6', '10', '16', '26']);

  describe('resolveSchemeFromChain', () => {
    it('returns the scheme when the category itself declares one', () => {
      expect(resolveSchemeFromChain([{ sizeScheme: SizeScheme.RING_INDIA }])).toBe(
        SizeScheme.RING_INDIA,
      );
    });

    it('inherits from a parent when the child declares none', () => {
      // "Solitaire" under "Rings" is sized without restating it.
      expect(
        resolveSchemeFromChain([{ sizeScheme: null }, { sizeScheme: SizeScheme.RING_INDIA }]),
      ).toBe(SizeScheme.RING_INDIA);
    });

    it('returns null when no ancestor declares a scheme', () => {
      // Earrings: a root category with NULL has nothing to inherit.
      expect(resolveSchemeFromChain([{ sizeScheme: null }, { sizeScheme: null }])).toBeNull();
    });

    it('lets NONE override a sized parent (§7.1 — adjustable rings)', () => {
      // The bug this exists for: with NULL alone, Adjustable under Rings
      // inherited RING_INDIA. Caught by running resolution against real rows.
      expect(
        resolveSchemeFromChain([
          { sizeScheme: SizeScheme.NONE },
          { sizeScheme: SizeScheme.RING_INDIA },
        ]),
      ).toBeNull();
    });

    it('distinguishes NONE from NULL — NULL still inherits', () => {
      expect(
        resolveSchemeFromChain([{ sizeScheme: null }, { sizeScheme: SizeScheme.RING_INDIA }]),
      ).toBe(SizeScheme.RING_INDIA);
      expect(
        resolveSchemeFromChain([
          { sizeScheme: SizeScheme.NONE },
          { sizeScheme: SizeScheme.RING_INDIA },
        ]),
      ).toBeNull();
    });

    it('stops at the nearest NONE even with a sized grandparent', () => {
      expect(
        resolveSchemeFromChain([
          { sizeScheme: null },
          { sizeScheme: SizeScheme.NONE },
          { sizeScheme: SizeScheme.RING_INDIA },
        ]),
      ).toBeNull();
    });

    it('takes the nearest ancestor when several declare a scheme', () => {
      expect(
        resolveSchemeFromChain([
          { sizeScheme: SizeScheme.BRACELET_LENGTH_MM },
          { sizeScheme: SizeScheme.RING_INDIA },
        ]),
      ).toBe(SizeScheme.BRACELET_LENGTH_MM);
    });

    it('returns null for an empty chain rather than throwing', () => {
      expect(resolveSchemeFromChain([])).toBeNull();
    });
  });

  describe('assertVariantSizes — sized category', () => {
    it('accepts a variant whose size is in the scheme', () => {
      expect(() =>
        assertVariantSizes([{ sku: 'R-1', size: '16' }], SizeScheme.RING_INDIA, RING_SIZES),
      ).not.toThrow();
    });

    it('rejects a variant with no size (§7.4 — joins the publish check)', () => {
      expect(() =>
        assertVariantSizes([{ sku: 'R-1', size: null }], SizeScheme.RING_INDIA, RING_SIZES),
      ).toThrow(BadRequestException);
    });

    it('treats an empty string as missing, not as a value', () => {
      expect(() =>
        assertVariantSizes([{ sku: 'R-1', size: '' }], SizeScheme.RING_INDIA, RING_SIZES),
      ).toThrow(/needs a size/);
    });

    it('rejects a size outside the seeded range (§7.7 bulk import)', () => {
      // Size 30 exists on published charts but is outside the adopted 6-26
      // retail range, so it must be refused rather than silently accepted.
      expect(() =>
        assertVariantSizes([{ sku: 'R-1', size: '30' }], SizeScheme.RING_INDIA, RING_SIZES),
      ).toThrow(/not a valid RING_INDIA value/);
    });

    it('names the offending SKU and the valid values, for bulk import (§7.7)', () => {
      // A bulk CSV rejection saying only "invalid size" is unactionable across
      // 1,045 rows — the message has to identify the row and the vocabulary.
      expect(() =>
        assertVariantSizes([{ sku: 'RING-999', size: '99' }], SizeScheme.RING_INDIA, RING_SIZES),
      ).toThrow(/RING-999.*Valid values: 6, 10, 16, 26/s);
    });

    it('checks every variant, not just the first', () => {
      expect(() =>
        assertVariantSizes(
          [
            { sku: 'R-1', size: '16' },
            { sku: 'R-2', size: 'nonsense' },
          ],
          SizeScheme.RING_INDIA,
          RING_SIZES,
        ),
      ).toThrow(/R-2/);
    });
  });

  describe('assertVariantSizes — unsized category', () => {
    it('accepts a variant with no size', () => {
      expect(() =>
        assertVariantSizes([{ sku: 'E-1', size: null }], null, new Set()),
      ).not.toThrow();
    });

    it('accepts an omitted size field', () => {
      expect(() => assertVariantSizes([{ sku: 'E-1' }], null, new Set())).not.toThrow();
    });

    it('rejects a size set on an unsized category (§7.1 adjustable rings)', () => {
      // This half matters as much as the other: without it, a stray size
      // survives into the payload and the storefront renders a size selector
      // for a product that has no size.
      expect(() => assertVariantSizes([{ sku: 'E-1', size: '16' }], null, new Set())).toThrow(
        /has no sizing scheme/,
      );
    });

    it('accepts an empty-string size on an unsized category', () => {
      // Empty means absent; a CSV column that exists but is blank is not an
      // attempt to set a size.
      expect(() => assertVariantSizes([{ sku: 'E-1', size: '' }], null, new Set())).not.toThrow();
    });
  });

  it('accepts an empty variant list', () => {
    expect(() => assertVariantSizes([], SizeScheme.RING_INDIA, RING_SIZES)).not.toThrow();
  });
});
