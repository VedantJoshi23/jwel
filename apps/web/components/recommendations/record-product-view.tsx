'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getAnonymousId } from '@/lib/anonymous-id';
import { recordProductView } from '@/lib/api/recommendations';

/**
 * Records that this product was viewed.
 *
 * Renders nothing. It exists because **nothing was tracking views at all** —
 * `POST /products/:id/views` was built, `ProductView` was in the schema, and no
 * storefront code ever called it, which meant recently-viewed and the
 * personalised rail were computing over an empty table.
 *
 * Fires once per mount rather than on every render, and deliberately not
 * deduplicated: `ProductView` is an **append-only event log**, not a "last
 * viewed" row, because recency ranking needs the full history
 * (`DOM-RECOMMENDATION` Invariant 1).
 */
export function RecordProductView({ productId }: { productId: string }) {
  const { token } = useAuth();

  useEffect(() => {
    // The API keys the row on the user when there is one, and ignores the
    // anonymous id in that case (Invariant 2's XOR).
    void recordProductView(productId, getAnonymousId(), token);
  }, [productId, token]);

  return null;
}
