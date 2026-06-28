import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriceTag } from './price-tag';

describe('PriceTag', () => {
  it('renders the formatted price', () => {
    render(<PriceTag amountMinorUnits={259900} />);
    expect(screen.getByText('₹2,599')).toBeInTheDocument();
  });

  it('shows a struck-through compare-at price when it is higher than the current price', () => {
    render(<PriceTag amountMinorUnits={199900} compareAtMinorUnits={259900} />);
    expect(screen.getByText('₹2,599')).toBeInTheDocument();
    expect(screen.getByText('₹1,999')).toBeInTheDocument();
  });

  it('does not show a compare-at price when it is not higher than the current price', () => {
    render(<PriceTag amountMinorUnits={259900} compareAtMinorUnits={259900} />);
    expect(screen.queryAllByText('₹2,599')).toHaveLength(1);
  });

  it('does not show a compare-at price when none is given', () => {
    const { container } = render(<PriceTag amountMinorUnits={100000} />);
    expect(container.querySelector('.line-through')).toBeNull();
  });
});
