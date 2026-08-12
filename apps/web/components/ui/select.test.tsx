import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select } from './select';

describe('Select', () => {
  it('renders its options', () => {
    render(
      <Select aria-label="pick one">
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    );
    expect(screen.getByRole('combobox', { name: 'pick one' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument();
  });

  it('calls onChange when a new option is selected', () => {
    const onChange = vi.fn();
    render(
      <Select aria-label="pick one" onChange={onChange}>
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'pick one' }), { target: { value: 'b' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('forwards a ref to the underlying select element', () => {
    let ref: HTMLSelectElement | null = null;
    render(
      <Select
        aria-label="pick one"
        ref={(el) => {
          ref = el;
        }}
      >
        <option value="a">A</option>
      </Select>,
    );
    expect(ref).toBeInstanceOf(HTMLSelectElement);
  });
});
