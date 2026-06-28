import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Separator } from './separator';

describe('Separator', () => {
  it('renders with role="separator"', () => {
    render(<Separator />);
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('merges a custom className', () => {
    render(<Separator className="my-4" />);
    expect(screen.getByRole('separator')).toHaveClass('my-4');
  });
});
