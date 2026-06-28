import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VariantSelector } from './variant-selector';
import type { ProductVariant } from '@/lib/api/types';

function fakeVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: 'v1',
    sku: 'SKU-1',
    metal: 'GOLD',
    purity: '18K',
    size: null,
    weightGrams: '2.5',
    basePriceMinorUnits: 250000,
    ...overrides,
  };
}

describe('VariantSelector', () => {
  it('renders a radio per variant with a combined metal/purity/size label', () => {
    render(
      <VariantSelector
        variants={[fakeVariant({ id: 'v1', metal: 'GOLD', purity: '18K', size: '7' })]}
        selectedId="v1"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole('radio', { name: 'GOLD · 18K · 7' })).toBeInTheDocument();
  });

  it('marks the selected variant as checked', () => {
    render(
      <VariantSelector
        variants={[fakeVariant({ id: 'v1' }), fakeVariant({ id: 'v2', sku: 'SKU-2' })]}
        selectedId="v2"
        onSelect={vi.fn()}
      />,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('aria-checked', 'false');
    expect(radios[1]).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onSelect with the clicked variant id', () => {
    const onSelect = vi.fn();
    render(
      <VariantSelector
        variants={[fakeVariant({ id: 'v1' }), fakeVariant({ id: 'v2', sku: 'SKU-2' })]}
        selectedId="v1"
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getAllByRole('radio')[1]);
    expect(onSelect).toHaveBeenCalledWith('v2');
  });

  it('omits null fields (e.g. no size) from the label', () => {
    render(
      <VariantSelector variants={[fakeVariant({ id: 'v1', size: null })]} selectedId="v1" onSelect={vi.fn()} />,
    );
    expect(screen.getByRole('radio', { name: 'GOLD · 18K' })).toBeInTheDocument();
  });
});
