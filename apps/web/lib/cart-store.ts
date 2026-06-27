import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartLine {
  variantId: string;
  productSlug: string;
  productName: string;
  metal: string;
  size: string | null;
  unitPriceMinorUnits: number;
  quantity: number;
}

interface CartState {
  lines: CartLine[];
  addLine: (line: CartLine) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeLine: (variantId: string) => void;
  clear: () => void;
}

// Backend (apps/api) has no persisted Cart API yet — BACKEND.md §4 names this
// gap explicitly. The bag is client-only state here; checkout submits these
// lines directly as the `items[]` array `POST /orders` already expects
// (CreateOrderDto), so no server-side cart round-trip is needed for MVP.
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      addLine: (line) => {
        const existing = get().lines.find((l) => l.variantId === line.variantId);
        if (existing) {
          set({
            lines: get().lines.map((l) =>
              l.variantId === line.variantId ? { ...l, quantity: l.quantity + line.quantity } : l,
            ),
          });
        } else {
          set({ lines: [...get().lines, line] });
        }
      },
      updateQuantity: (variantId, quantity) => {
        set({
          lines: get()
            .lines.map((l) => (l.variantId === variantId ? { ...l, quantity } : l))
            .filter((l) => l.quantity > 0),
        });
      },
      removeLine: (variantId) => set({ lines: get().lines.filter((l) => l.variantId !== variantId) }),
      clear: () => set({ lines: [] }),
    }),
    { name: 'jwel-cart' },
  ),
);

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPriceMinorUnits * l.quantity, 0);
}

export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}
