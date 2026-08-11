import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Reveal, RevealSection } from './reveal';

/**
 * jsdom has no IntersectionObserver, which `whileInView` needs. A stub that
 * never fires is the right shape here: these tests are about what gets
 * rendered and which element it is, not about the animation running.
 */
beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
});

describe('Reveal', () => {
  it('renders its children', () => {
    // ADR-0019 — motion is baseline now, not theme-gated, so there is
    // nothing theme-specific left to assert here.
    render(<Reveal>content</Reveal>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('passes its className through', () => {
    render(<Reveal className="px-6">content</Reveal>);
    expect(screen.getByText('content')).toHaveClass('px-6');
  });

  it('accepts a stagger delay', () => {
    render(
      <Reveal delay={0.1} className="px-6">
        content
      </Reveal>,
    );
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});

describe('RevealSection', () => {
  it('renders a real <section>, so the page keeps its landmark structure', () => {
    // The reason this component exists rather than a <div> wrapped around a
    // <section>: no extra box, and the homepage's band structure is unchanged.
    const { container } = render(<RevealSection className="py-11">band</RevealSection>);
    const section = container.querySelector('section');
    expect(section).not.toBeNull();
    expect(section).toHaveClass('py-11');
    expect(section).toHaveTextContent('band');
  });
});
