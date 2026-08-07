import { describe, expect, it } from 'vitest';
import { resolveCategoryScheme } from './size-scheme';
import type { Category } from './api/types';

/**
 * FEAT-SIZE-TAXONOMY — this mirrors the API's `resolveSchemeFromChain`, and the
 * cases are deliberately the same ones. A divergence between the two shows up
 * as an admin form offering sizes the API then rejects, which is silent until
 * someone tries to save.
 */
const cat = (over: Partial<Category> & { id: string }): Category => ({
  name: over.id,
  slug: over.id,
  parentId: null,
  ...over,
});

describe('resolveCategoryScheme', () => {
  const rings = cat({ id: 'rings', sizeScheme: 'RING_INDIA' });
  const earrings = cat({ id: 'earrings', sizeScheme: null });
  const solitaire = cat({ id: 'solitaire', parentId: 'rings', sizeScheme: null });
  const adjustable = cat({ id: 'adjustable', parentId: 'rings', sizeScheme: 'NONE' });
  const all = [rings, earrings, solitaire, adjustable];

  it('returns the scheme a category declares itself', () => {
    expect(resolveCategoryScheme('rings', all)).toBe('RING_INDIA');
  });

  it('inherits a parent scheme through a null child', () => {
    expect(resolveCategoryScheme('solitaire', all)).toBe('RING_INDIA');
  });

  it('lets NONE override a sized parent (adjustable rings)', () => {
    // The bug this guards: with null alone, Adjustable inherited RING_INDIA.
    expect(resolveCategoryScheme('adjustable', all)).toBeNull();
  });

  it('returns null for a root category with no scheme', () => {
    expect(resolveCategoryScheme('earrings', all)).toBeNull();
  });

  it('returns null when no category is selected', () => {
    expect(resolveCategoryScheme('', all)).toBeNull();
    expect(resolveCategoryScheme(null, all)).toBeNull();
    expect(resolveCategoryScheme(undefined, all)).toBeNull();
  });

  it('returns null for an unknown category id', () => {
    expect(resolveCategoryScheme('nope', all)).toBeNull();
  });

  it('stops at a missing parent rather than throwing', () => {
    const orphan = cat({ id: 'orphan', parentId: 'gone', sizeScheme: null });
    expect(resolveCategoryScheme('orphan', [orphan])).toBeNull();
  });

  it('terminates on a category cycle instead of hanging', () => {
    const a = cat({ id: 'a', parentId: 'b', sizeScheme: null });
    const b = cat({ id: 'b', parentId: 'a', sizeScheme: null });
    expect(resolveCategoryScheme('a', [a, b])).toBeNull();
  });

  it('takes the nearest ancestor when several declare a scheme', () => {
    const child = cat({ id: 'child', parentId: 'rings', sizeScheme: 'BRACELET_LENGTH_MM' });
    expect(resolveCategoryScheme('child', [...all, child])).toBe('BRACELET_LENGTH_MM');
  });
});
