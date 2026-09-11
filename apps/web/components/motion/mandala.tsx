'use client';

import { useId } from 'react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Vector recreation of the client's reference mandala (`apps/web/public/
 * reference/…33_18…png`, kept out of git — see `.gitignore`), traced from
 * that image rather than approximated from memory: centre dot, a 16-petal
 * inner lotus, a beaded double-circle band, an 8-petal ring with a diamond
 * accent inside each petal, four finial ornaments at the cardinal points, a
 * second larger echo-ring of 8 petals, and a faint outer boundary — matching
 * the reference's own layering, in that order, outward from the centre.
 *
 * Built as real vector geometry, not an embedded copy of the source image:
 * every ring below is one shape defined once, pointing "north," rotated into
 * place by a `<g transform="rotate(...)">` per copy — crisp at any size, a
 * few KB instead of the reference's ~1.3MB, and it can be told to draw its
 * own outline in rather than only fading, which a raster image cannot.
 *
 * `viewBox="0 0 500 500"`, centre at (250, 250). Every primitive below is
 * expressed once "pointing north" (toward the top of the circle) purely in
 * radius/width terms, then duplicated at each angle via a rotation group —
 * this is what keeps the geometry math in one place instead of repeated
 * trigonometry per shape.
 */

const CX = 250;
const CY = 250;

function leaf(rBase: number, rTip: number, halfWidth: number): string {
  const mid = (rBase + rTip) / 2;
  const base = `${CX} ${CY - rBase}`;
  const tip = `${CX} ${CY - rTip}`;
  return `M ${base} Q ${CX - halfWidth} ${CY - mid} ${tip} Q ${CX + halfWidth} ${CY - mid} ${base} Z`;
}

function diamond(r: number, size: number): string {
  const y = CY - r;
  return `M ${CX} ${y - size} L ${CX + size * 0.62} ${y} L ${CX} ${y + size} L ${CX - size * 0.62} ${y} Z`;
}

/** N copies of one "north-pointing" shape, evenly spaced starting from 0°. */
function Ring({ count, offset = 0, children }: { count: number; offset?: number; children: React.ReactNode }) {
  const step = 360 / count;
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <g key={i} transform={`rotate(${offset + i * step} ${CX} ${CY})`}>
          {children}
        </g>
      ))}
    </>
  );
}

export function Mandala({ className, spin = true }: { className?: string; spin?: boolean }) {
  const prefersReducedMotion = useReducedMotion();
  const titleId = useId();
  // `prefersReducedMotion === null` (preference not yet known on the very
  // first client render) is treated the same as reduced, same reasoning as
  // `components/motion/reveal.tsx` — better a still mandala for one frame
  // than a spin that has to be cancelled the instant the preference resolves.
  const animate = spin && prefersReducedMotion === false;

  return (
    <svg
      viewBox="0 0 500 500"
      role="img"
      aria-labelledby={titleId}
      className={cn('overflow-visible', className)}
    >
      <title id={titleId}>Decorative mandala</title>
      <g
        fill="none"
        stroke="url(#mandala-gold)"
        strokeWidth={1.4}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      >
        <defs>
          {/* Warm gold, brighter toward the upper-left — the reference's own
              linework catches light unevenly rather than reading as a flat
              stencil colour. */}
          <linearGradient id="mandala-gold" x1="15%" y1="10%" x2="85%" y2="95%">
            <stop offset="0%" stopColor="#f3d9a0" />
            <stop offset="45%" stopColor="#d9b766" />
            <stop offset="100%" stopColor="#a97f3f" />
          </linearGradient>
        </defs>

        {/* Centre */}
        <circle cx={CX} cy={CY} r={5} fill="url(#mandala-gold)" stroke="none" />

        {/* Inner lotus — 16 petals in two layers (offset 11.25° from each
            other), wide enough relative to their length to read as layered
            petal outlines rather than a spike-burst sunburst. */}
        <Ring count={16}>
          <path d={leaf(4, 80, 24)} />
        </Ring>
        <Ring count={16} offset={11.25}>
          <path d={leaf(4, 62, 18)} />
        </Ring>

        {/* Beaded double-circle band around the lotus. */}
        <circle cx={CX} cy={CY} r={92} />
        <circle cx={CX} cy={CY} r={98} />
        <Ring count={30}>
          <circle cx={CX} cy={CY - 95} r={1.6} fill="url(#mandala-gold)" stroke="none" />
        </Ring>

        {/* Diamonds sitting in the gaps between the eight large petals. */}
        <Ring count={8} offset={22.5}>
          <path d={diamond(98, 7)} />
        </Ring>

        {/* The eight large petals, each with a small diamond inside near the
            tip — matching the accent the reference carries inside every
            outer petal, not only between them. */}
        <Ring count={8}>
          <path d={leaf(103, 226, 32)} />
          <path d={diamond(178, 6)} />
        </Ring>

        {/* Boundary circle the large-petal tips and the cardinal finials
            sit on. */}
        <circle cx={CX} cy={CY} r={229} />

        {/* Finial ornaments at N/S/E/W only — a small ball over a diamond,
            sitting just outside the boundary the large petals reach. */}
        <Ring count={4}>
          <circle cx={CX} cy={CY - 240} r={2.6} fill="url(#mandala-gold)" stroke="none" />
          <path d={diamond(232, 5.5)} />
        </Ring>

        {/* Second, larger echo ring of eight petals — the reference repeats
            the same petal motif once more, further out, partially cropped by
            its own frame; unlike that crop, this component's viewBox shows
            the full ring. */}
        <Ring count={8}>
          <path d={leaf(234, 420, 52)} />
        </Ring>

        {/* Faint outermost boundary. */}
        <circle cx={CX} cy={CY} r={440} strokeOpacity={0.5} />
        <Ring count={4}>
          <path d={diamond(444, 6)} strokeOpacity={0.5} />
        </Ring>
      </g>

      {animate && (
        <style>{`
          svg > g { transform-origin: ${CX}px ${CY}px; animation: mandala-spin 220s linear infinite; }
          @keyframes mandala-spin { to { transform: rotate(360deg); } }
        `}</style>
      )}
    </svg>
  );
}
