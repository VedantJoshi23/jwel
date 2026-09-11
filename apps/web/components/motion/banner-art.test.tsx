import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BannerArt } from './banner-art';

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
}

describe('BannerArt', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is entirely decorative — hidden from assistive tech, and never intercepts a click meant for the text or buttons over it', () => {
    stubReducedMotion(false);
    const { container } = render(<BannerArt />);
    const root = container.firstElementChild!;
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root.className).toContain('pointer-events-none');
  });

  it('switches the mandala to a darkening blend on a light panel, not the lightening one tuned for a dark one', () => {
    // `overlay` washes gold linework to near-invisibility on an
    // already-light background; `multiply` is what stays visible there.
    stubReducedMotion(false);
    const dark = render(<BannerArt tone="dark" />);
    const light = render(<BannerArt tone="light" />);

    expect(dark.container.querySelector('svg')?.getAttribute('class')).toContain('mix-blend-overlay');
    expect(light.container.querySelector('svg')?.getAttribute('class')).toContain('mix-blend-multiply');
  });

  it('bleeds off the requested edge', () => {
    stubReducedMotion(false);
    const right = render(<BannerArt side="right" />);
    const left = render(<BannerArt side="left" />);

    expect(right.container.querySelector('svg')?.getAttribute('class')).toContain('right-[-30%]');
    expect(left.container.querySelector('svg')?.getAttribute('class')).toContain('left-[-30%]');
  });
});
