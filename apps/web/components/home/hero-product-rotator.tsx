'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Pause, Play } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * The hero's tinted glass window, crossfading slowly through a handful of
 * real catalogue pieces.
 *
 * Deliberately **decoration, not merchandising**: the images are
 * `aria-hidden`, carry no name or price, and link nowhere. The hero already
 * has two calls to action, and a third clickable thing competing with them
 * was judged not worth it. That choice is what lets the pieces keep the
 * `mix-blend-multiply` treatment — washing out something you are asking
 * someone to click would be the wrong trade, but for atmosphere it is the
 * whole point.
 *
 * Three constraints shape the rest:
 *
 * 1. **WCAG 2.2.2 (Level A).** Content that animates automatically for more
 *    than five seconds alongside other content needs a way to stop it. Hence
 *    the pause control — and it sits *outside* the `aria-hidden` subtree,
 *    because focusable content inside `aria-hidden` is its own violation
 *    (axe's `aria-hidden-focus`).
 * 2. **Shuffle on the client, after mount.** Randomising on the server would
 *    either mismatch hydration or — worse, since the page is cached — freeze
 *    one "random" order into the cache for every visitor until it
 *    revalidates.
 * 3. **Load two images, not six.** Only the current frame and the one after
 *    it are mounted, so the rotation costs one extra request up front rather
 *    than the whole set. The first frame is the LCP candidate and is the only
 *    one marked `priority`.
 */

const ROTATE_MS = 5000;

/** Fisher–Yates. Returns a new array; never mutates the server-passed prop. */
function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function HeroProductRotator({ images, blend = true }: { images: string[]; blend?: boolean }) {
  const prefersReducedMotion = useReducedMotion();
  // Server and first client render both show the unshuffled list, so the
  // markup matches; the shuffle lands in an effect immediately after.
  const [order, setOrder] = useState<string[]>(images);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => setOrder(shuffled(images)), [images]);

  // `null` (preference not yet known) is treated as reduced, same reasoning
  // as components/motion/reveal.tsx — better a still frame for one tick than
  // a fade that has to be cancelled the moment the preference resolves.
  const canRotate = order.length > 1 && prefersReducedMotion === false;
  const rotating = canRotate && !paused;

  useEffect(() => {
    if (!rotating) return;
    const id = setInterval(() => setCurrent((i) => (i + 1) % order.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [rotating, order.length]);

  return (
    <div className="relative mx-auto w-full max-w-[280px] lg:max-w-[320px]">
      {/*
        The pane is a sibling painted *behind* the product, not a wrapper
        around it. `backdrop-filter` creates an isolated blend group, so a
        multiplying child inside this element would have nothing to blend
        against and the studio white would stay a solid white block.
      */}
      <div className="absolute inset-0 rounded-m border border-white/50 bg-white/25 shadow-card backdrop-blur-md" />
      {/* The lighter top edge is the one cue that says the surface has a
          thickness catching the light, not a flat wash of colour. */}
      <div className="absolute inset-x-0 top-0 h-px rounded-t-m bg-white/70" />

      <div className="relative aspect-[4/5] p-4" aria-hidden="true">
        <div className="relative h-full w-full">
          {order.map((src, i) => {
            // Only the visible frame and the next one exist in the DOM.
            const next = (current + 1) % order.length;
            if (i !== current && i !== next) return null;
            return (
              <Image
                key={src}
                src={src}
                alt=""
                fill
                priority={i === 0}
                sizes="(min-width: 1024px) 320px, 280px"
                className={cn(
                  'transition-opacity duration-1000 ease-in-out',
                  // Multiplying drops the studio white into the glass, so the
                  // piece sits behind the pane rather than on a white card
                  // laid over it. Lifestyle fallbacks carry their own
                  // background and cannot blend away, so they fill instead.
                  blend ? 'object-contain mix-blend-multiply' : 'rounded-s object-cover',
                  i === current ? 'opacity-100' : 'opacity-0',
                )}
              />
            );
          })}
        </div>
      </div>

      {canRotate && (
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          aria-label={paused ? 'Resume the product slideshow' : 'Pause the product slideshow'}
          className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-surface/70 text-ink-secondary backdrop-blur transition-colors hover:bg-surface hover:text-ink-primary"
        >
          {paused ? (
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Pause className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}
