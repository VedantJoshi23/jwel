import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SiteFooter } from './footer';

describe('SiteFooter', () => {
  it('renders the newsletter signup copy', () => {
    render(<SiteFooter />);
    expect(screen.getByText(/Let.s stay in touch!/)).toBeInTheDocument();
  });

  it('renders a "Help" navigation section', () => {
    render(<SiteFooter />);
    expect(screen.getByRole('navigation', { name: 'Help' })).toBeInTheDocument();
  });

  it('renders an "Other" navigation section', () => {
    render(<SiteFooter />);
    expect(screen.getByRole('navigation', { name: 'Other' })).toBeInTheDocument();
  });
});
