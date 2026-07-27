import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SiteChrome } from './site-chrome';

// Header and footer are covered by their own specs and drag in the auth/cart
// stores and next/navigation. Stubbing them keeps this spec about the one
// thing SiteChrome itself decides: the order of the slots.
vi.mock('./header', () => ({ SiteHeader: () => <header>site header</header> }));
vi.mock('./footer', () => ({ SiteFooter: () => <footer>site footer</footer> }));
vi.mock('./demo-mode-banner', () => ({
  DemoModeBanner: () => <div data-testid="demo-banner">demo banner</div>,
}));

describe('SiteChrome', () => {
  it('renders its children inside the main landmark', () => {
    render(
      <SiteChrome>
        <p>page content</p>
      </SiteChrome>,
    );
    expect(screen.getByRole('main')).toHaveTextContent('page content');
  });

  it('gives main the id the skip-link targets', () => {
    render(
      <SiteChrome>
        <p>page content</p>
      </SiteChrome>,
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('renders the header and footer around the content', () => {
    render(
      <SiteChrome>
        <p>page content</p>
      </SiteChrome>,
    );
    expect(screen.getByText('site header')).toBeInTheDocument();
    expect(screen.getByText('site footer')).toBeInTheDocument();
  });

  it('places the demo banner above the header', () => {
    const { container } = render(
      <SiteChrome>
        <p>page content</p>
      </SiteChrome>,
    );
    const order = Array.from(container.querySelectorAll('[data-testid="demo-banner"], header'));
    // A "no payment is taken" notice below the shop chrome can be scrolled
    // past without being seen, which defeats the point of showing it.
    expect(order[0]).toHaveAttribute('data-testid', 'demo-banner');
    expect(order[1]?.tagName).toBe('HEADER');
  });
});
