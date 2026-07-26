import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from './page-header';

describe('PageHeader', () => {
  it('renders the title as the page’s h1', () => {
    render(<PageHeader title="About us" />);
    expect(screen.getByRole('heading', { level: 1, name: 'About us' })).toBeInTheDocument();
  });

  it('renders the subtitle when one is given', () => {
    render(<PageHeader title="About us" subtitle="The people behind the workshop" />);
    expect(screen.getByText('The people behind the workshop')).toBeInTheDocument();
  });

  it('omits the subtitle paragraph entirely when it is not given', () => {
    const { container } = render(<PageHeader title="About us" />);
    // Not merely absent text — the <p> must not render at all, or the header
    // carries the subtitle's margin with nothing in it.
    expect(container.querySelector('p')).toBeNull();
  });

  it('omits the subtitle for an empty string', () => {
    const { container } = render(<PageHeader title="About us" subtitle="" />);
    expect(container.querySelector('p')).toBeNull();
  });
});
