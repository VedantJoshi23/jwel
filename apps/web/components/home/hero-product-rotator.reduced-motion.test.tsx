import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { HeroProductRotator } from './hero-product-rotator';

/**
 * Its own file, deliberately. framer-motion's `useReducedMotion` reads
 * `matchMedia` exactly once per module registry — `initPrefersReducedMotion`
 * guards itself with a module-level flag that never resets — so stubbing a
 * different value in a later test of the same file has no effect. Vitest
 * gives each test *file* a fresh registry, which is what makes the stub
 * below actually take.
 */
vi.stubGlobal(
  'matchMedia',
  vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
);

describe('HeroProductRotator under reduced motion', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('never advances, and offers no pause control for motion that never starts', () => {
    render(<HeroProductRotator images={['/a.jpg', '/b.jpg', '/c.jpg']} />);
    const before = document.querySelector('img.opacity-100')?.getAttribute('src');

    act(() => void vi.advanceTimersByTime(30000));

    expect(document.querySelector('img.opacity-100')?.getAttribute('src')).toBe(before);
    expect(screen.queryByRole('button', { name: /slideshow/i })).toBeNull();
  });
});
