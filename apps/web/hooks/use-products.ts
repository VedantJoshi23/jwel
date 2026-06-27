'use client';

import { useQuery } from '@tanstack/react-query';
import { getProductReviews, getProducts, type ProductQuery } from '@/lib/api/products';

export function useProducts(query: ProductQuery) {
  return useQuery({
    queryKey: ['products', query],
    queryFn: () => getProducts(query, false),
  });
}

export function useProductReviews(productId: string, page = 1) {
  return useQuery({
    queryKey: ['reviews', productId, page],
    queryFn: () => getProductReviews(productId, page),
  });
}
