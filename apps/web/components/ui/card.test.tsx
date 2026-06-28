import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardContent } from './card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>content</Card>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('merges a custom className', () => {
    const { container } = render(<Card className="custom-class">x</Card>);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});

describe('CardContent', () => {
  it('renders children', () => {
    render(<CardContent>inner</CardContent>);
    expect(screen.getByText('inner')).toBeInTheDocument();
  });
});
