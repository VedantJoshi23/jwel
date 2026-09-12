'use client';

import { useId } from 'react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * The client's reference mandala, used as its own line art rather than
 * re-drawn.
 *
 * This was previously a hand-traced SVG — ~60 paths built from rotation
 * groups, rebuilt once already after a first pass got the petal silhouette
 * and ring count wrong. It was still only an approximation: the source has
 * ten-plus concentric bands, sixteen-fold symmetry, and a layered centre
 * rosette whose petals overlap at a density that is not realistically
 * reachable by hand-fitting Béziers. The client's verdict on the rebuilt
 * version was that it still did not match, which is the honest outcome for
 * that approach rather than a bug in it.
 *
 * So the linework now comes from the reference image itself. A build-time
 * pass (documented in `ADR-0027`) high-passes the source — subtract a heavy
 * Gaussian blur from the luminance, which removes the maroon ground and its
 * lens flares while leaving the thin gold strokes — and keeps the result as
 * an alpha channel, clipped to the largest circle fully inside the frame so
 * the disc is symmetric rather than cut off top and bottom the way the
 * source is. 760×760, 38KB.
 *
 * It is applied as a CSS **mask**, not painted as an image: the asset
 * carries shape only, and the gold gradient below supplies the colour. That
 * keeps the one thing the vector version was genuinely better at — the motif
 * re-colouring itself per banner tone instead of baking one gold into the
 * pixels — and it is why this is a `mask-image` on a gradient-filled div
 * rather than an `<img>` or a `next/image`.
 */

const MASK_SRC = '/images/motifs/mandala.webp';

/** Warm gold, brighter toward the upper-left — the reference's own linework
 *  catches light unevenly rather than reading as a flat stencil colour. */
const GOLD = 'linear-gradient(135deg, #f3d9a0 0%, #d9b766 45%, #a97f3f 100%)';

export function Mandala({ className, spin = true }: { className?: string; spin?: boolean }) {
  const prefersReducedMotion = useReducedMotion();
  const rawId = useId();
  // `prefersReducedMotion === null` (preference not yet known on the very
  // first client render) is treated the same as reduced, same reasoning as
  // `components/motion/reveal.tsx` — better a still mandala for one frame
  // than a spin that has to be cancelled the instant the preference resolves.
  const animate = spin && prefersReducedMotion === false;
  // Scoped so a second Mandala on the same page that opted out of spinning
  // is not started by this one's stylesheet. `useId` returns ":r0:"-style
  // values, whose colons are not valid in a class name.
  const cls = `mandala-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div
      role="img"
      aria-label="Decorative mandala"
      className={cn(cls, className)}
      style={{
        backgroundImage: GOLD,
        maskImage: `url("${MASK_SRC}")`,
        WebkitMaskImage: `url("${MASK_SRC}")`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    >
      {animate && (
        <style>{`
          .${cls} { animation: mandala-spin 220s linear infinite; }
          @keyframes mandala-spin { to { transform: rotate(360deg); } }
        `}</style>
      )}
    </div>
  );
}
