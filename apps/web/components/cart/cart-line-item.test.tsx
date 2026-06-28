import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CartLineItemRow } from './cart-line-item';
import type { CartLine } from '@/lib/cart-store';

function fakeLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    variantId: 'v1',
    productSlug: 'gold-ring',
    productName: 'Gold Ring',
    metal: 'GOLD',
    size: null,
    unitPriceMinorUnits: 100000,
    quantity: 2,
    ...overrides,
  };
}

describe('CartLineItemRow', () => {
  it('shows the product name and metal', () => {
    render(<CartLineItemRow line={fakeLine()} onQuantityChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('Gold Ring')).toBeInTheDocument();
    expect(screen.getByText('GOLD')).toBeInTheDocument();
  });

  it('appends the size when present', () => {
    render(<CartLineItemRow line={fakeLine({ size: '7' })} onQuantityChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('GOLD · 7')).toBeInTheDocument();
  });

  it('shows the line total as unit price × quantity', () => {
    render(<CartLineItemRow line={fakeLine({ unitPriceMinorUnits: 100000, quantity: 2 })} onQuantityChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('₹2,000')).toBeInTheDocument();
  });

  it('calls onQuantityChange when the stepper is used', () => {
    const onQuantityChange = vi.fn();
    render(<CartLineItemRow line={fakeLine({ quantity: 2 })} onQuantityChange={onQuantityChange} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Increase quantity'));
    expect(onQuantityChange).toHaveBeenCalledWith(3);
  });

  it('calls onRemove when the remove button is clicked', () => {
    const onRemove = vi.fn();
    render(<CartLineItemRow line={fakeLine()} onQuantityChange={vi.fn()} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: /Remove/ }));
    expect(onRemove).toHaveBeenCalled();
  });
});
