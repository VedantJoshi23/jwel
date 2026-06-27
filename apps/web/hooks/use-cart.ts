'use client';

import { useMemo } from 'react';
import { cartItemCount, cartSubtotal, useCartStore } from '@/lib/cart-store';

export function useCart() {
  const lines = useCartStore((s) => s.lines);
  const addLine = useCartStore((s) => s.addLine);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeLine = useCartStore((s) => s.removeLine);
  const clear = useCartStore((s) => s.clear);

  const subtotalMinorUnits = useMemo(() => cartSubtotal(lines), [lines]);
  const itemCount = useMemo(() => cartItemCount(lines), [lines]);

  return { lines, addLine, updateQuantity, removeLine, clear, subtotalMinorUnits, itemCount };
}
