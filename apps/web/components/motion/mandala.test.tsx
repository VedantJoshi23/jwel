import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Mandala } from './mandala';

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
}

describe('Mandala', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is purely decorative — an image role with a name, not exposed as content to tab through', () => {
    stubReducedMotion(false);
    render(<Mandala />);
    expect(screen.getByRole('img', { name: 'Decorative mandala' })).toBeInTheDocument();
  });

  it('spins by default once the motion preference is known to allow it', () => {
    stubReducedMotion(false);
    const { container } = render(<Mandala />);
    expect(container.querySelector('style')?.textContent).toContain('mandala-spin');
  });

  it('does not spin when the caller opts out, independent of the motion preference', () => {
    stubReducedMotion(false);
    const { container } = render(<Mandala spin={false} />);
    expect(container.querySelector('style')).toBeNull();
  });

  it('draws the reference line art as a mask over a gold fill, not as a flat image', () => {
    stubReducedMotion(false);
    render(<Mandala />);
    const el = screen.getByRole('img', { name: 'Decorative mandala' });

    // The asset supplies shape only. If it were ever switched to a plain
    // background-image, the motif would carry its own baked-in colour and
    // BannerArt's `tone` would stop being able to re-colour it.
    expect(el).toHaveStyle({ maskImage: 'url("/images/motifs/mandala.webp")' });
    expect(el.style.backgroundImage).toContain('linear-gradient');
  });

  it('scopes its spin stylesheet so a second, opted-out mandala is not started by it', () => {
    stubReducedMotion(false);
    const { container } = render(
      <>
        <Mandala />
        <Mandala spin={false} />
      </>,
    );
    const [spinning, still] = Array.from(container.querySelectorAll<HTMLElement>('[role="img"]'));
    const sheet = container.querySelector('style')?.textContent ?? '';

    // The rule must name the spinning instance's own class and no other.
    const spinningClass = Array.from(spinning.classList).find((c) => c.startsWith('mandala-'));
    const stillClass = Array.from(still.classList).find((c) => c.startsWith('mandala-'));
    expect(sheet).toContain(`.${spinningClass}`);
    expect(sheet).not.toContain(`.${stillClass}`);
  });
});
