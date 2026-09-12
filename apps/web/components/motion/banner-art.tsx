import { Mandala } from './mandala';
import { cn } from '@/lib/utils';

/**
 * Decorative treatment for a banner panel, replacing "plain purple/pink
 * space" per the client's ask — traced from the mood of their second
 * reference image (soft diagonal light across a plain wall, a mandala-like
 * gold linework panel inset in an arch) rather than that image's literal
 * photography, since this has to sit behind real heading text at every
 * panel width the brand's banners actually render at, which a fixed photo
 * cannot.
 *
 * Two layers, both `aria-hidden` and both absolutely filling the nearest
 * `relative` ancestor — this component contributes no layout of its own,
 * so it drops into an existing banner panel without changing its size:
 *
 * 1. A soft diagonal light wash (plain CSS gradient, not an image — a
 *    photograph of "light crossing a wall" would tint every banner it sits
 *    behind the same way regardless of that panel's own background colour;
 *    a white-based gradient blend works over both the hero's dark gradient
 *    and the collection page's pale one).
 * 2. The `Mandala` component, oversized and bled off one edge so it reads
 *    as an accent rather than the banner's whole content, at low opacity so
 *    text placed over this panel keeps its contrast.
 */
export function BannerArt({
  className,
  side = 'right',
  tone = 'dark',
}: {
  className?: string;
  side?: 'left' | 'right';
  /**
   * `dark` for a panel like the hero's brand-gradient text band; `light` for
   * a pale one like the collection page's `bg-surface-band` title strip. One
   * blend mode does not read correctly on both: `overlay` washes gold
   * linework out to near-invisibility on an already-light lavender ground,
   * and a white light-ray wash disappears the same way. `light` swaps to
   * `multiply`, which darkens rather than lightens, and an ink-tinted wash.
   */
  tone?: 'dark' | 'light';
}) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background:
            tone === 'dark'
              ? 'linear-gradient(115deg, transparent 25%, rgba(255,255,255,0.14) 45%, transparent 62%)'
              : 'linear-gradient(115deg, transparent 25%, rgba(31,20,32,0.05) 45%, transparent 62%)',
        }}
      />
      {/*
        ── Mandala strength lives here ──────────────────────────────────
        These two `opacity-[…]` values are the dial for how strongly the
        motif reads; raise them to make it more visible, lower them to push
        it back. They are deliberately separate per tone because the blend
        modes are not equally strong: `overlay` on the dark panel carries
        further at the same opacity than `multiply` does on a pale one, so
        the light panel needs the larger number to match it by eye.

        The ceiling is contrast, not taste: heading text sits over this, so
        anything high enough to compete with the type is too high.
      */}
      <Mandala
        className={cn(
          'absolute top-1/2 h-[140%] w-[140%] -translate-y-1/2',
          tone === 'dark' ? 'opacity-[0.28] mix-blend-overlay' : 'opacity-[0.38] mix-blend-multiply',
          side === 'right' ? 'right-[-30%]' : 'left-[-30%]',
        )}
      />
    </div>
  );
}
