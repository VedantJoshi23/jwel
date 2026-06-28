import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from './input';

describe('Input', () => {
  it('renders with the given type', () => {
    render(<Input type="email" placeholder="email" />);
    expect(screen.getByPlaceholderText('email')).toHaveAttribute('type', 'email');
  });

  it('calls onChange when typed into', () => {
    const onChange = vi.fn();
    render(<Input onChange={onChange} placeholder="x" />);
    fireEvent.change(screen.getByPlaceholderText('x'), { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('forwards a ref to the underlying input element', () => {
    let ref: HTMLInputElement | null = null;
    render(<Input ref={(el) => (ref = el)} placeholder="x" />);
    expect(ref).toBeInstanceOf(HTMLInputElement);
  });
});
