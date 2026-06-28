import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderSummary } from './order-summary';

describe('OrderSummary', () => {
  it('shows the subtotal', () => {
    render(<OrderSummary subtotalMinorUnits={100000} shippingMinorUnits={5000} />);
    expect(screen.getByText('₹1,000')).toBeInTheDocument();
  });

  it('shows "Free" shipping when shippingMinorUnits is 0', () => {
    render(<OrderSummary subtotalMinorUnits={100000} />);
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('shows the shipping amount when it is non-zero', () => {
    render(<OrderSummary subtotalMinorUnits={100000} shippingMinorUnits={5000} />);
    expect(screen.getByText('₹50')).toBeInTheDocument();
  });

  it('omits the discount row when there is no discount', () => {
    render(<OrderSummary subtotalMinorUnits={100000} />);
    expect(screen.queryByText('Discount')).not.toBeInTheDocument();
  });

  it('shows a negative discount amount when present', () => {
    render(<OrderSummary subtotalMinorUnits={100000} discountMinorUnits={10000} />);
    expect(screen.getByText('-₹100')).toBeInTheDocument();
  });

  it('computes the total as subtotal - discount + shipping', () => {
    render(<OrderSummary subtotalMinorUnits={100000} discountMinorUnits={10000} shippingMinorUnits={5000} />);
    expect(screen.getByText('₹950')).toBeInTheDocument(); // 1000 - 100 + 50
  });
});
