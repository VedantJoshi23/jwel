import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Mandala } from './mandala';

/**
 * Split into its own file, deliberately. framer-motion's `useReducedMotion`
 * reads `matchMedia` exactly once per process — `initPrefersReducedMotion`
 * in motion-dom guards itself with a module-level `hasReducedMotionListener`
 * flag that never resets, so stubbing a *different* `matchMedia` value in a
 * later test within the same file has no effect on it; only the very first
 * read in a given module registry counts. Vitest gives each test *file* a
 * fresh module registry, so putting the reduced-motion case in its own file
 * is what makes stubbing it here actually take effect, rather than being
 * silently shadowed by whatever mandala.test.tsx's own first render already
 * cached.
 */
vi.stubGlobal(
  'matchMedia',
  vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
);

describe('Mandala under reduced motion', () => {
  it('never spins, however the caller asked', () => {
    const { container } = render(<Mandala spin />);
    expect(container.querySelector('style')).toBeNull();
  });
});
