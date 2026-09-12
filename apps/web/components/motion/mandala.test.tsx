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

  it('renders real path-drawn geometry — the ring of large petals, the core, and their diamond accents', () => {
    stubReducedMotion(false);
    const { container } = render(<Mandala />);
    // 8 large onion-dome petals + 8 in-petal diamonds + 8 between-petal
    // diamonds + 8 cardinal-finial diamonds + 4 diagonal diamonds + 28
    // core-rosette petals (14 + 14) = 64 <path> elements. Not asserted as an
    // exact count (that would just re-encode the component's own geometry
    // into the test); the structural claim this guards is that the SVG has
    // real drawn shapes, not an empty or broken shell.
    expect(container.querySelectorAll('path').length).toBeGreaterThan(30);
    expect(container.querySelectorAll('circle').length).toBeGreaterThan(3);
  });
});
