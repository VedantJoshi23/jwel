import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { HeroProductRotator } from './hero-product-rotator';

// Motion allowed for this whole file. The reduced-motion case lives in
// hero-product-rotator.reduced-motion.test.tsx — framer-motion reads
// `matchMedia` once per module registry, so both cannot share a file.
vi.stubGlobal(
  'matchMedia',
  vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
);

const IMAGES = ['/a.jpg', '/b.jpg', '/c.jpg'];

function srcsOnScreen() {
  return Array.from(document.querySelectorAll('img')).map((i) => i.getAttribute('src') ?? '');
}

/** Which image is actually showing — the others are mounted at opacity 0. */
function visibleSrc() {
  const shown = Array.from(document.querySelectorAll('img')).find((i) =>
    i.className.includes('opacity-100'),
  );
  return shown?.getAttribute('src') ?? null;
}

describe('HeroProductRotator', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('mounts only the current frame and the next one, not the whole set', () => {
    render(<HeroProductRotator images={IMAGES} />);
    // Six products in the rotation must not mean six image requests on load.
    expect(screen.getAllByRole('presentation', { hidden: true }).length).toBeLessThanOrEqual(2);
  });

  it('advances to another image once the interval elapses', () => {
    render(<HeroProductRotator images={IMAGES} />);
    const first = visibleSrc();

    act(() => void vi.advanceTimersByTime(5000));

    expect(visibleSrc()).not.toBe(first);
  });

  it('stops advancing once paused, and resumes when pressed again', () => {
    render(<HeroProductRotator images={IMAGES} />);
    const control = screen.getByRole('button', { name: /pause the product slideshow/i });

    act(() => control.click());
    const frozen = visibleSrc();
    act(() => void vi.advanceTimersByTime(20000));
    expect(visibleSrc()).toBe(frozen);

    act(() => screen.getByRole('button', { name: /resume the product slideshow/i }).click());
    act(() => void vi.advanceTimersByTime(5000));
    expect(visibleSrc()).not.toBe(frozen);
  });

  it('keeps the pause control outside the aria-hidden images, so it is not focusable-but-hidden', () => {
    const { container } = render(<HeroProductRotator images={IMAGES} />);
    const hiddenRegion = container.querySelector('[aria-hidden="true"]');
    const control = screen.getByRole('button', { name: /pause the product slideshow/i });

    // axe's `aria-hidden-focus`: a focusable element inside an aria-hidden
    // subtree is reachable by keyboard but invisible to assistive tech.
    expect(hiddenRegion).not.toBeNull();
    expect(hiddenRegion!.contains(control)).toBe(false);
  });

  it('offers no pause control for a single image, having nothing to rotate', () => {
    render(<HeroProductRotator images={['/only.jpg']} />);
    expect(screen.queryByRole('button', { name: /slideshow/i })).toBeNull();
    expect(srcsOnScreen().length).toBe(1);
  });

  it('renders the server order on first paint, so hydration matches', () => {
    // The shuffle is deliberately deferred to an effect; asserting the very
    // first commit here is what guards that it stays deferred.
    render(<HeroProductRotator images={IMAGES} />);
    expect(visibleSrc()).toContain('a.jpg');
  });
});
