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

  describe('image (opt-in, ADR-0026)', () => {
    it('renders no background image by default — every page but About', () => {
      const { container } = render(<PageHeader title="Shipping" />);
      expect(container.querySelector('img')).toBeNull();
    });

    it('renders the background image and its dark wash when one is given', () => {
      const { container } = render(<PageHeader title="Our Story" image="/images/banners/arched-room.webp" />);
      const img = container.querySelector('img');
      expect(img).toHaveAttribute(
        'src',
        expect.stringContaining(encodeURIComponent('/images/banners/arched-room.webp')),
      );
      // Decorative — the heading itself carries the page's meaning, and this
      // is reference photography of an empty room, nothing needing a name.
      expect(img).toHaveAttribute('alt', '');
    });

    it('switches the whole header to white text over the photo, not the default dark-on-light', () => {
      const { container: withImage } = render(
        <PageHeader title="Our Story" image="/images/banners/arched-room.webp" />,
      );
      const { container: plain } = render(<PageHeader title="Shipping" />);

      expect(withImage.firstElementChild).toHaveClass('text-white');
      expect(plain.firstElementChild).not.toHaveClass('text-white');
    });
  });
});
