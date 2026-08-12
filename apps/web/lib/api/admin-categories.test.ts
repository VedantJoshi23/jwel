import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adminCreateCategory,
  adminDeleteCategory,
  adminUpdateCategory,
} from './admin-categories';

describe('admin-categories API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('adminCreateCategory POSTs the input to the admin categories endpoint', async () => {
    await adminCreateCategory('token-1', { name: 'Rings', slug: 'rings' });
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/categories');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ name: 'Rings', slug: 'rings' });
  });

  it('adminCreateCategory forwards a null parentId for a top-level category', async () => {
    // null and undefined are not interchangeable here: the API distinguishes
    // "no parent" from "field not supplied", and JSON.stringify drops the key
    // entirely for undefined.
    await adminCreateCategory('token-1', { name: 'Rings', parentId: null });
    const [, options] = (fetch as any).mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ name: 'Rings', parentId: null });
  });

  it('adminUpdateCategory PATCHes the category-specific path', async () => {
    await adminUpdateCategory('token-1', 'c1', { name: 'Ear rings' });
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/categories/c1');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ name: 'Ear rings' });
  });

  it('adminUpdateCategory sends a partial body without filling in absent fields', async () => {
    await adminUpdateCategory('token-1', 'c1', { sortOrder: 3 });
    const [, options] = (fetch as any).mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ sortOrder: 3 });
  });

  it('adminUpdateCategory forwards a sizeScheme change', async () => {
    await adminUpdateCategory('token-1', 'c1', { sizeScheme: 'RING_INDIA' });
    const [, options] = (fetch as any).mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ sizeScheme: 'RING_INDIA' });
  });

  it('adminUpdateCategory forwards a null sizeScheme to revert to "inherit from parent"', async () => {
    await adminUpdateCategory('token-1', 'c1', { sizeScheme: null });
    const [, options] = (fetch as any).mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ sizeScheme: null });
  });

  it('adminDeleteCategory DELETEs the category', async () => {
    await adminDeleteCategory('token-1', 'c1');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/categories/c1');
    expect(options.method).toBe('DELETE');
  });
});
