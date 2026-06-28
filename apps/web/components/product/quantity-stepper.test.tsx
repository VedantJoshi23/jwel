import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuantityStepper } from './quantity-stepper';

describe('QuantityStepper', () => {
  it('displays the current value', () => {
    render(<QuantityStepper value={3} onChange={vi.fn()} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('calls onChange with value + 1 when increase is clicked', () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={2} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Increase quantity'));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('calls onChange with value - 1 when decrease is clicked', () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={2} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Decrease quantity'));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('disables the decrease button at the minimum', () => {
    render(<QuantityStepper value={1} onChange={vi.fn()} min={1} />);
    expect(screen.getByLabelText('Decrease quantity')).toBeDisabled();
  });

  it('disables the increase button at the maximum', () => {
    render(<QuantityStepper value={10} onChange={vi.fn()} max={10} />);
    expect(screen.getByLabelText('Increase quantity')).toBeDisabled();
  });

  it('does not disable either button strictly between min and max', () => {
    render(<QuantityStepper value={5} onChange={vi.fn()} min={1} max={10} />);
    expect(screen.getByLabelText('Decrease quantity')).not.toBeDisabled();
    expect(screen.getByLabelText('Increase quantity')).not.toBeDisabled();
  });
});
