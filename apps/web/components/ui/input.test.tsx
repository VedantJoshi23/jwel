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
    // Block body, not `(el) => (ref = el)` — a callback ref must return
    // void or a cleanup function (React 19's ref-cleanup typing); an
    // assignment expression implicitly returns the assigned value, which
    // is a type error now even though it worked at runtime before.
    render(
      <Input
        ref={(el) => {
          ref = el;
        }}
        placeholder="x"
      />,
    );
    expect(ref).toBeInstanceOf(HTMLInputElement);
  });
});
