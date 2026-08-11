'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { crossFade, springs } from '@/lib/motion';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger sibling sections by a few hundred ms. Ignored under reduced motion. */
  delay?: number;
}

/**
 * Materialises a section as it scrolls into view — both themes, since
 * `ADR-0019` promoted motion from an Aurora-only experiment to the baseline
 * language.
 *
 * "Materialize, don't just fade" (design-update.md §12): blur radius and scale
 * animate together so a surface reads as a real material arriving rather than
 * a plain opacity ramp. That is also why this animates `filter`, which §11
 * otherwise warns off as not compositor-friendly — here it *is* the effect,
 * and it runs once per section on entry rather than continuously.
 *
 * Reduced motion keeps the opacity change — it aids comprehension and is not
 * vestibular — and drops the travel, the scale and the blur.
 *
 * `useReducedMotion()` returns `null` on the very first client render (it
 * reads `matchMedia` in an effect; SSR can't know the preference). An earlier
 * version trusted that transient `null` as "not reduced" and started the full
 * spring/blur animation immediately — if a section's `whileInView` observer
 * fired before the hook resolved, and it usually does resolve first since
 * IntersectionObserver callbacks are inherently async, but was not guaranteed
 * to on every load, the section could commit to the un-reduced hidden→shown
 * transform with `viewport.once: true` locking it in, leaving reduced-motion
 * users with a section that "shows" as opacity:1 while still carrying leftover
 * blur/scale in its computed style. Returning `null` here — rendered as a
 * plain, unanimated wrapper one level up — closes that race: nothing capable
 * of animating exists until the preference is actually known.
 */
function useRevealProps(delay: number) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion === null) return null;

  const hidden = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, y: 24, scale: 0.98, filter: 'blur(10px)' };

  const shown = prefersReducedMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' };

  return {
    initial: hidden,
    whileInView: shown,
    // `once` because a section that re-animates every time it scrolls back
    // past is decoration, not comprehension. `amount: 0.15` fires early enough
    // that the section is never caught mid-materialise.
    viewport: { once: true, amount: 0.15 },
    transition: prefersReducedMotion ? crossFade : { ...springs.ui, delay },
  };
}

/** Reveal wrapper for arbitrary content. */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const revealProps = useRevealProps(delay);
  if (!revealProps) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} {...revealProps}>
      {children}
    </motion.div>
  );
}

/**
 * Reveal that *is* the `<section>`, rather than a `<div>` wrapped around one.
 * This is the form the homepage uses: it keeps the landmark structure and the
 * section's own classes exactly as they were, and adds no extra box to the DOM
 * for a page that is a stack of full-bleed bands.
 */
export function RevealSection({ children, className, delay = 0 }: RevealProps) {
  const revealProps = useRevealProps(delay);
  if (!revealProps) return <section className={className}>{children}</section>;
  return (
    <motion.section className={className} {...revealProps}>
      {children}
    </motion.section>
  );
}
