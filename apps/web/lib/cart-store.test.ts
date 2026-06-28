import { beforeEach, describe, expect, it } from 'vitest';
import { useCartStore, cartSubtotal, cartItemCount, type CartLine } from './cart-store';

function fakeLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    variantId: 'v1',
    productSlug: 'gold-ring',
    productName: 'Gold Ring',
    metal: 'GOLD',
    size: null,
    unitPriceMinorUnits: 250000,
    quantity: 1,
    ...overrides,
  };
}

describe('useCartStore', () => {
  beforeEach(() => {
    useCartStore.getState().clear();
  });

  it('adds a new line', () => {
    useCartStore.getState().addLine(fakeLine());
    expect(useCartStore.getState().lines).toHaveLength(1);
  });

  it('merges quantity (does not duplicate) when adding the same variant twice', () => {
    useCartStore.getState().addLine(fakeLine({ quantity: 1 }));
    useCartStore.getState().addLine(fakeLine({ quantity: 2 }));
    expect(useCartStore.getState().lines).toHaveLength(1);
    expect(useCartStore.getState().lines[0].quantity).toBe(3);
  });

  it('adds a separate line for a different variant', () => {
    useCartStore.getState().addLine(fakeLine({ variantId: 'v1' }));
    useCartStore.getState().addLine(fakeLine({ variantId: 'v2' }));
    expect(useCartStore.getState().lines).toHaveLength(2);
  });

  it('updateQuantity sets the new quantity for the matching line', () => {
    useCartStore.getState().addLine(fakeLine({ quantity: 1 }));
    useCartStore.getState().updateQuantity('v1', 5);
    expect(useCartStore.getState().lines[0].quantity).toBe(5);
  });

  it('updateQuantity to 0 removes the line entirely', () => {
    useCartStore.getState().addLine(fakeLine());
    useCartStore.getState().updateQuantity('v1', 0);
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it('removeLine removes only the matching variant', () => {
    useCartStore.getState().addLine(fakeLine({ variantId: 'v1' }));
    useCartStore.getState().addLine(fakeLine({ variantId: 'v2' }));
    useCartStore.getState().removeLine('v1');
    expect(useCartStore.getState().lines.map((l) => l.variantId)).toEqual(['v2']);
  });

  it('clear empties the cart', () => {
    useCartStore.getState().addLine(fakeLine());
    useCartStore.getState().clear();
    expect(useCartStore.getState().lines).toHaveLength(0);
  });
});

describe('cartSubtotal', () => {
  it('sums unitPrice × quantity across all lines', () => {
    const lines = [fakeLine({ unitPriceMinorUnits: 1000, quantity: 2 }), fakeLine({ unitPriceMinorUnits: 500, quantity: 3 })];
    expect(cartSubtotal(lines)).toBe(3500);
  });

  it('returns 0 for an empty cart', () => {
    expect(cartSubtotal([])).toBe(0);
  });
});

describe('cartItemCount', () => {
  it('sums quantities across all lines', () => {
    const lines = [fakeLine({ quantity: 2 }), fakeLine({ quantity: 3 })];
    expect(cartItemCount(lines)).toBe(5);
  });

  it('returns 0 for an empty cart', () => {
    expect(cartItemCount([])).toBe(0);
  });
});
