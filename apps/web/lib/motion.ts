import type { Transition } from 'framer-motion';

/**
 * Motion tokens — the spring values from design-update.md §4, in one place so
 * no component hand-tunes numbers. Every value here is defensible; none is a
 * round number picked because it looked about right.
 *
 * Apple's two designer-facing parameters map onto Framer Motion's spring API
 * almost directly:
 *
 *   damping ratio  →  `bounce`    (damping 1.0 = bounce 0 = no overshoot)
 *   response       →  `duration`  (how fast it reaches target, *not* a fixed
 *                                  run time — a spring has no fixed duration)
 *
 * The house default is critically damped. Overshoot is reserved for motion the
 * user's own gesture put momentum into: bounce on a card you flicked feels
 * right, bounce on a menu that merely faded in feels wrong.
 */
export const springs = {
  /** Default for anything the interface initiates. Apple's move/reposition values. */
  ui: { type: 'spring', bounce: 0, duration: 0.4 },
  /** Only after a flick, throw or drag release — damping ~0.8. */
  momentum: { type: 'spring', bounce: 0.2, duration: 0.4 },
  /** Drawers and sheets — snappier response, slight overshoot. */
  sheet: { type: 'spring', bounce: 0.2, duration: 0.3 },
} as const satisfies Record<string, Transition>;

/**
 * The non-vestibular equivalent used whenever `prefers-reduced-motion` is set.
 * Reduced motion is not *no* feedback — it is a short opacity cross-fade in
 * place of the slide, spring or parallax (§14).
 */
export const crossFade: Transition = { duration: 0.2, ease: 'easeOut' };

/**
 * Apple's momentum projection, verbatim from the *Designing Fluid Interfaces*
 * sample code (§6): where a flick would come to rest, so a gesture can be
 * snapped to the target nearest its *projected* endpoint rather than to
 * whatever happened to be closest at the instant the finger lifted.
 *
 * Note this is the exponential-decay form, not the physics-textbook
 * `v²/(2·decel)`. The latter is not what Apple ships and feels wrong.
 *
 * @param initialVelocity release velocity in px/s
 * @param decelerationRate 0.998 for normal scroll feel, 0.99 for snappier
 * @returns the distance in px the gesture would still travel
 */
export function project(initialVelocity: number, decelerationRate = 0.998): number {
  return ((initialVelocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Progressive resistance past a boundary (§9). A hard stop reads as frozen;
 * continuous resistance reads as "responsive, but there is nothing more here".
 * The further past the bound the drag goes, the less the element follows.
 *
 * @param overshoot how far past the boundary the pointer is, in px
 * @param dimension the size of the dragged surface along that axis, in px
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
