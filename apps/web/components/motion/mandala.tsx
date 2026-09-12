'use client';

import { useId } from 'react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Vector recreation of the client's reference mandala (`apps/web/public/
 * reference/…33_18…png`, kept out of git — see `.gitignore`), traced from
 * that image at full resolution rather than approximated from memory —
 * including a first pass that got the centre flower and the petal shape
 * wrong (a plain lens instead of the reference's crossing onion-dome
 * outline, and an invented second petal ring that the source does not have)
 * and was rebuilt after comparing screenshots against the source crop by
 * crop. Outward from the centre: a lotus core of 8 onion-dome petals, a
 * beaded double-circle band, an 8-petal ring of the same onion-dome shape
 * with a diamond accent inside each petal and another in the gaps between
 * them, eight boundary ornaments alternating a diamond-and-bowtie finial at
 * the four cardinal points with a plain diamond at the four diagonal ones,
 * and a faint, sparsely-dotted outer circle — no second petal ring, which
 * the source genuinely does not have past the one boundary circle.
 *
 * Built as real vector geometry, not an embedded copy of the source image:
 * every shape is defined once "pointing north," rotated into place by a
 * `<g transform="rotate(...)">` per copy — crisp at any size, a few KB
 * instead of the reference's ~1.3MB, and able to draw its own outline in
 * rather than only fade, which a raster image cannot.
 *
 * `viewBox="0 0 500 500"`, centre at (250, 250).
 */

const CX = 250;
const CY = 250;

/**
 * The onion-dome / ogee-arch petal the reference actually uses, not a plain
 * symmetric lens: wide low down, pinched into a narrow "neck" before the
 * final point — the same silhouette as an onion dome or an ogee arch. One
 * cubic Bézier per side sharing the base and tip; each side's own control
 * points bow the curve out wide early (~30% of the way up) then pull back
 * in sharply near the top (~85%) for the neck, mirrored left/right into one
 * closed, fillable outline.
 */
function onionPetal(rBase: number, rTip: number, halfWidth: number): string {
  const length = rTip - rBase;
  const base = `${CX} ${CY - rBase}`;
  const tip = `${CX} ${CY - rTip}`;
  const wideY = CY - (rBase + length * 0.36);
  const neckY = CY - (rBase + length * 0.91);
  const right = `C ${CX + halfWidth} ${wideY} ${CX + halfWidth * 0.16} ${neckY} ${tip}`;
  const left = `C ${CX - halfWidth * 0.16} ${neckY} ${CX - halfWidth} ${wideY} ${base}`;
  return `M ${base} ${right} ${left} Z`;
}

/**
 * The inner flower's own petal shape — sharp and pointed, not the outer
 * ring's onion-dome. The reference draws its dense centre rosette in a
 * visibly different style from the large petals around it (a fine, layered
 * star rather than a repeat of the same lens at a smaller scale, which is
 * what an earlier pass here got wrong); a plain quadratic curve per side,
 * narrower and straighter than `onionPetal`'s cubic, is what keeps that
 * contrast.
 */
function sharpPetal(rBase: number, rTip: number, halfWidth: number): string {
  const base = `${CX} ${CY - rBase}`;
  const tip = `${CX} ${CY - rTip}`;
  const mid = CY - (rBase + rTip) / 2;
  return `M ${base} Q ${CX - halfWidth} ${mid} ${tip} Q ${CX + halfWidth} ${mid} ${base} Z`;
}

function diamond(r: number, size: number, aspect = 1): string {
  const y = CY - r;
  return `M ${CX} ${y - size} L ${CX + size * 0.62 * aspect} ${y} L ${CX} ${y + size} L ${CX - size * 0.62 * aspect} ${y} Z`;
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

/** The diamond-over-bowtie ornament sitting on the boundary circle at the four cardinal points. */
function CardinalFinial({ r }: { r: number }) {
  const bowtieY = CY - (r - 10);
  const bowtieHalf = 7;
  return (
    <>
      <path d={diamond(r + 16, 5.5)} />
      <path
        d={`M ${CX - bowtieHalf} ${bowtieY - 6} Q ${CX} ${bowtieY} ${CX - bowtieHalf} ${bowtieY + 6} M ${CX + bowtieHalf} ${bowtieY - 6} Q ${CX} ${bowtieY} ${CX + bowtieHalf} ${bowtieY + 6}`}
      />
      <path d={diamond(r, 4)} />
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
        strokeLinecap="round"
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

        {/* Centre: a ring around a bright core, not a plain filled dot. */}
        <circle cx={CX} cy={CY} r={9} />
        <circle cx={CX} cy={CY} r={4} fill="url(#mandala-gold)" stroke="none" />

        {/* Lotus core — 14 fine, pointed petals in two overlapping layers.
            Deliberately not the outer ring's onion-dome shape at a smaller
            scale: the reference draws its centre in a visibly sharper,
            denser style, and repeating the outer motif here lost that
            contrast on an earlier pass. */}
        <Ring count={14}>
          <path d={sharpPetal(6, 62, 12)} />
        </Ring>
        <Ring count={14} offset={12.86}>
          <path d={sharpPetal(6, 48, 9)} />
        </Ring>

        {/* Beaded double-circle band around the lotus. */}
        <circle cx={CX} cy={CY} r={96} />
        <circle cx={CX} cy={CY} r={102} />
        <Ring count={30}>
          <circle cx={CX} cy={CY - 99} r={1.6} fill="url(#mandala-gold)" stroke="none" />
        </Ring>

        {/* The eight large onion-dome petals. */}
        <Ring count={8}>
          <path d={onionPetal(107, 228, 54)} />
        </Ring>

        {/* Diamonds inside each petal and in the gaps between them — the
            reference keeps both at nearly the same radius band rather than
            one hugging the hub and one out at mid-petal. */}
        <Ring count={8}>
          <path d={diamond(163, 7, 1.3)} />
        </Ring>
        <Ring count={8} offset={22.5}>
          <path d={diamond(150, 6, 1.3)} />
        </Ring>

        {/* Boundary circle the petal tips and the eight ornaments sit on. */}
        <circle cx={CX} cy={CY} r={231} />

        {/* Eight boundary ornaments, alternating two styles — a fuller
            diamond-bowtie-diamond finial at the four petal axes that land on
            true N/S/E/W, a single plain diamond at the four in between. */}
        <Ring count={4}>
          <CardinalFinial r={231} />
        </Ring>
        <Ring count={4} offset={45}>
          <path d={diamond(231, 5)} />
        </Ring>

        {/* Faint, sparsely-dotted outer circle — the reference has no second
            petal ring past the boundary above, only this. */}
        <circle cx={CX} cy={CY} r={280} strokeOpacity={0.4} />
        <Ring count={16} offset={11}>
          <circle cx={CX} cy={CY - 280} r={1.3} strokeOpacity={0.5} fill="url(#mandala-gold)" stroke="none" />
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
