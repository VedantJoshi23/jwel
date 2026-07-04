import { getProducts } from '@/lib/api/products';
import type { PaginatedResult, Product } from '@/lib/api/types';

/** Homepage sections degrade to an empty list (not a crash) if the API is unreachable. */
export async function safeGetProducts(query: Parameters<typeof getProducts>[0]): Promise<Product[]> {
  try {
    const result = await getProducts(query);
    return result.items;
  } catch {
    return [];
  }
}

/** Same degradation as safeGetProducts, but keeps `total` — for callers that
 * need a real category count (e.g. "12 pieces"), not just the items. */
export async function safeGetProductsResult(
  query: Parameters<typeof getProducts>[0],
): Promise<PaginatedResult<Product>> {
  try {
    return await getProducts(query);
  } catch {
    return { items: [], page: 1, pageSize: query?.pageSize ?? 12, total: 0 };
  }
}
