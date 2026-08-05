import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PromoBanners } from './promo-banners';
import type { ActiveBanner } from '@/lib/api/types';

function banner(overrides: Partial<ActiveBanner> = {}): ActiveBanner {
  return {
    id: 'b1',
    title: 'Diwali Edit',
    imageRef: 'local:banners/diwali.jpg',
    imageUrl: 'https://api.example.com/uploads/banners/diwali.jpg',
    linkUrl: null,
    sortOrder: 0,
    isActive: true,
    startsAt: null,
    endsAt: null,
    ...overrides,
  };
}

describe('PromoBanners', () => {
  it('renders nothing when no banners are active', () => {
    const { container } = render(<PromoBanners banners={[]} />);
    // Not an empty <section>: a store with no campaign scheduled should look
    // exactly as it did before this section existed.
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the banner image with its title as alt text', () => {
    render(<PromoBanners banners={[banner()]} />);
    expect(screen.getByAltText('Diwali Edit')).toBeInTheDocument();
  });

  it('renders an unlinked banner as an image with no anchor', () => {
    render(<PromoBanners banners={[banner({ linkUrl: null })]} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('links a root-relative path internally', () => {
    render(<PromoBanners banners={[banner({ linkUrl: '/collections/rings' })]} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/collections/rings');
    expect(link).not.toHaveAttribute('rel');
  });

  it('marks an absolute http(s) link as external', () => {
    render(<PromoBanners banners={[banner({ linkUrl: 'https://partner.example/sale' })]} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://partner.example/sale');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  // The API validates linkUrl, but rows predate that validation and a stored
  // value only the writer ever checked is one migration away from unchecked.
  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['protocol-relative', '//evil.example/x'],
  ])('renders no anchor at all for a %s linkUrl', (_label, linkUrl) => {
    render(<PromoBanners banners={[banner({ linkUrl })]} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    // The banner itself still renders — a bad link degrades to a plain image
    // rather than removing scheduled content from the page.
    expect(screen.getByAltText('Diwali Edit')).toBeInTheDocument();
  });

  it('renders every active banner, preserving the order the API returned', () => {
    render(
      <PromoBanners
        banners={[
          banner({ id: 'b1', title: 'First', sortOrder: 0 }),
          banner({ id: 'b2', title: 'Second', sortOrder: 1 }),
        ]}
      />,
    );

    const alts = screen.getAllByRole('img').map((img) => img.getAttribute('alt'));
    expect(alts).toEqual(['First', 'Second']);
  });
});
