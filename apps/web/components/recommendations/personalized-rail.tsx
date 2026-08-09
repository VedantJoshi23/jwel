'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { getPersonalized, getTrending } from '@/lib/api/recommendations';
import { ProductRail } from './product-rail';

/**
 * "Recommended for you" when signed in, "Trending" otherwise.
 *
 * The heading changes with the source, which matters more than it looks:
 * calling a trending list "recommended for you" would claim a personalisation
 * that did not happen (Law 1). The API itself falls back to trending for a
 * signed-in customer with no purchase history — a cold start — and that case
 * is the one place the heading can overstate. Accepted: they *are* signed in,
 * and the fallback is the best recommendation available for them.
 */
export function RecommendedRail() {
  const { token, isAuthenticated } = useAuth();

  const { data } = useQuery({
    queryKey: ['recommendations', token],
    queryFn: () => (token ? getPersonalized(token) : getTrending()),
    retry: false,
  });

  return (
    <ProductRail
      title={isAuthenticated ? 'Recommended for you' : 'Trending now'}
      products={data ?? []}
    />
  );
}
