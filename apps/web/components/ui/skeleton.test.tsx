import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('renders a pulsing placeholder element', () => {
    const { container } = render(<Skeleton data-testid="sk" />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });

  it('merges a custom className', () => {
    const { container } = render(<Skeleton className="h-10 w-10" />);
    expect(container.firstChild).toHaveClass('h-10', 'w-10');
  });
});
