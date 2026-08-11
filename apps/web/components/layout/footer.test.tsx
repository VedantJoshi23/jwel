import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SiteFooter } from './footer';

describe('SiteFooter', () => {
  it('no longer offers a newsletter sign-up', () => {
    // Removed from display 2026-08-09 by owner decision. It was never a
    // working sign-up: a <p> that looked like a field, and a button with no
    // handler, in front of no mailing list. The invitation copy went with it
    // — an offer with nothing to accept it is worse than no offer.
    render(<SiteFooter />);
    expect(screen.queryByText(/Let.s stay in touch!/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sign up to our newsletter/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Subscribe/i })).not.toBeInTheDocument();
  });

  it('still shows the brand mark that shared that column', () => {
    render(<SiteFooter />);
    expect(screen.getAllByText(/ELYSIAN/i).length).toBeGreaterThan(0);
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
