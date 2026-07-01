import { getProducts } from '@/lib/api/products';
import type { Product } from '@/lib/api/types';

/** Homepage sections degrade to an empty list (not a crash) if the API is unreachable. */
export async function safeGetProducts(query: Parameters<typeof getProducts>[0]): Promise<Product[]> {
  try {
    const result = await getProducts(query);
    return result.items;
  } catch {
    return [];
  }
}
