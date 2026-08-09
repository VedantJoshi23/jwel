'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import {
  addCartLine,
  clearCart,
  getCart,
  removeCartLine,
  updateCartLine,
  type AddCartLineInput,
} from '@/lib/api/cart';
import type { ServerCartLine } from '@/lib/api/types';

/**
 * The bag, now held by the server.
 *
 * It used to be a `localStorage` zustand store, which meant a cart existed only
 * in the browser that made it: no cross-device persistence, and nothing the
 * server could reason about. `DOM-SHOPPING` models carts as rows with
 * invariants attached, and none of them could be enforced against a store the
 * API could not see.
 *
 * The shape of this hook is deliberately close to the one it replaces, so the
 * eight consumers change as little as possible — but two things had to move:
 *
 * - lines are addressed by **line id**, because a variant can now appear twice
 *   with different gift options (Invariant 1);
 * - every mutation is asynchronous, so callers that used to fire and forget
 *   now have a promise to wait on if they want one.
 *
 * Prices come from each line's **snapshot** (Invariant 3), not from today's
 * catalogue — a bag shows what the pieces cost when they went in.
 */
export interface CartLine {
  /** The line's own id. Use this to change or remove it, never the variant id. */
  id: string;
  variantId: string;
  productSlug: string;
  productName: string;
  metal: string;
  size: string | null;
  unitPriceMinorUnits: number;
  quantity: number;
  giftWrap: boolean;
  giftNote: string | null;
  /**
   * The product's own photograph, resolved to a URL by the API. Null when the
   * product has none — callers fall back to a stock image, the same way the
   * PDP and the product card already do.
   */
  imageUrl: string | null;
}

function toCartLine(line: ServerCartLine): CartLine {
  return {
    id: line.id,
    variantId: line.variantId,
    productSlug: line.variant.product.slug,
    productName: line.variant.product.name,
    metal: line.variant.metal,
    size: line.variant.size,
    unitPriceMinorUnits: line.priceSnapshotMinorUnits,
    quantity: line.quantity,
    giftWrap: line.giftWrap,
    giftNote: line.giftNote,
    imageUrl: line.variant.product.media?.[0]?.url ?? null,
  };
}

export function useCart() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  // Keyed by the token, so signing in or out fetches the right cart rather
  // than showing the previous identity's until something invalidates it.
  const { data, isLoading } = useQuery({
    queryKey: ['cart', token],
    queryFn: () => getCart(token ?? null),
    retry: false,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['cart'] });

  const add = useMutation({
    mutationFn: (input: AddCartLineInput) => addCartLine(token ?? null, input),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ lineId, quantity }: { lineId: string; quantity: number }) =>
      updateCartLine(token ?? null, lineId, quantity),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (lineId: string) => removeCartLine(token ?? null, lineId),
    onSuccess: invalidate,
  });
  const empty = useMutation({
    mutationFn: () => clearCart(token ?? null),
    onSuccess: invalidate,
  });

  const lines = useMemo(() => (data?.items ?? []).map(toCartLine), [data]);
  const subtotalMinorUnits = useMemo(
    () => lines.reduce((sum, line) => sum + line.unitPriceMinorUnits * line.quantity, 0),
    [lines],
  );
  const itemCount = useMemo(() => lines.reduce((sum, line) => sum + line.quantity, 0), [lines]);

  return {
    lines,
    isLoading,
    subtotalMinorUnits,
    itemCount,
    addLine: (input: AddCartLineInput) => add.mutateAsync(input),
    updateQuantity: (lineId: string, quantity: number) => update.mutateAsync({ lineId, quantity }),
    removeLine: (lineId: string) => remove.mutateAsync(lineId),
    clear: () => empty.mutateAsync(),
    isMutating: add.isPending || update.isPending || remove.isPending || empty.isPending,
  };
}
