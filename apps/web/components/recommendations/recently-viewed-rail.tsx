'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { getAnonymousId } from '@/lib/anonymous-id';
import { getRecentlyViewed } from '@/lib/api/recommendations';
import { ProductRail } from './product-rail';

/**
 * Client-side because the identity it needs lives in this browser — a guest's
 * `anonymousId` is in `localStorage` and cannot be read while rendering on the
 * server.
 *
 * `excludeProductId` keeps the product you are looking at out of its own
 * "recently viewed" rail, which would otherwise be its first entry the moment
 * the view above is recorded.
 */
export function RecentlyViewedRail({ excludeProductId }: { excludeProductId?: string }) {
  const { token } = useAuth();

  const { data } = useQuery({
    queryKey: ['recently-viewed', token, excludeProductId],
    queryFn: () => getRecentlyViewed(getAnonymousId(), token),
    // A failed rail is not worth retrying at a shopper's expense.
    retry: false,
  });

  const products = (data ?? []).filter((product) => product.productId !== excludeProductId);

  return <ProductRail title="Recently viewed" products={products} />;
}
