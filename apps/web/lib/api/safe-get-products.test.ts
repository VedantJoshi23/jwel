import { describe, expect, it, vi } from 'vitest';
import { safeGetProducts, safeGetProductsResult } from './safe-get-products';
import * as productsApi from './products';

describe('safeGetProducts', () => {
  it('returns the items from a successful call', async () => {
    vi.spyOn(productsApi, 'getProducts').mockResolvedValue({
      items: [{ id: 'p1' } as any],
      page: 1,
      pageSize: 12,
      total: 1,
    });
    expect(await safeGetProducts({})).toEqual([{ id: 'p1' }]);
  });

  it('degrades to an empty array instead of throwing when the API call fails', async () => {
    vi.spyOn(productsApi, 'getProducts').mockRejectedValue(new Error('API unreachable'));
    expect(await safeGetProducts({})).toEqual([]);
  });
});

describe('safeGetProductsResult', () => {
  it('returns the full paginated result from a successful call', async () => {
    const result = { items: [{ id: 'p1' } as any], page: 2, pageSize: 24, total: 5 };
    vi.spyOn(productsApi, 'getProducts').mockResolvedValue(result);
    expect(await safeGetProductsResult({ page: 2, pageSize: 24 })).toEqual(result);
  });

  it('degrades to an empty envelope (preserving the requested pageSize) when the API call fails', async () => {
    vi.spyOn(productsApi, 'getProducts').mockRejectedValue(new Error('API unreachable'));
    expect(await safeGetProductsResult({ pageSize: 24 })).toEqual({
      items: [],
      page: 1,
      pageSize: 24,
      total: 0,
    });
  });

  it('defaults pageSize to 12 when the caller passed no query at all', async () => {
    vi.spyOn(productsApi, 'getProducts').mockRejectedValue(new Error('API unreachable'));
    expect(await safeGetProductsResult(undefined as any)).toEqual({
      items: [],
      page: 1,
      pageSize: 12,
      total: 0,
    });
  });
});
