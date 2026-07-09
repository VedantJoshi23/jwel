import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  it('renders unchecked by default', () => {
    render(<Checkbox />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('calls onCheckedChange when clicked', () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox onCheckedChange={onCheckedChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('renders as checked when checked prop is true', () => {
    // No `onCheckedChange` needed here — this is a controlled, checked
    // render, not an interaction test; `readOnly` isn't a real prop on
    // Radix's Checkbox.Root (it's an HTML input attribute, not part of
    // Radix's checked/onCheckedChange-based API) and was a type error.
    render(<Checkbox checked />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});
