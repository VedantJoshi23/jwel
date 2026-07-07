'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { craftPolishImage, craftStoneSettingImage, craftToolsImage } from './images';
import { brand } from '@/lib/brand';

const FRAMES = [
  {
    label: 'Frame 01 · Molten Gold',
    image: null,
    background: 'radial-gradient(ellipse at 30% 40%, #C8A24A 0%, #8B6D2E 25%, #3A2A10 55%, #0F0A05 100%)',
    glow: 'radial-gradient(circle at 60% 70%, rgba(232,203,123,.4) 0%, transparent 40%)',
  },
  {
    label: 'Frame 02 · The Hammer',
    image: craftToolsImage,
  },
  {
    label: 'Frame 03 · Stone Setting',
    image: craftStoneSettingImage,
  },
  {
    label: 'Frame 04 · The Polish',
    image: craftPolishImage,
  },
];

/** Number of viewport-heights of vertical scroll used to drive the horizontal
 * traversal — tuned by feel, not derived from content width. */
const SCROLL_LENGTH_VH = 380;

export function VisionCraft() {
  const prefersReducedMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // Scroll-progress is written straight to `track.style.transform` in the
  // scroll handler itself — deliberately not going through a Framer Motion
  // value/`style` binding, since that indirection defers the actual DOM
  // write to Framer's internal render loop. A direct write has no such
  // dependency and applies the instant the scroll handler runs.
  useEffect(() => {
    if (prefersReducedMotion) return;

    function update() {
      const section = sectionRef.current;
      const track = trackRef.current;
      if (!section || !track) return;
      const rect = section.getBoundingClientRect();
      const pinnedScrollRange = rect.height - window.innerHeight;
      const progress = pinnedScrollRange > 0 ? Math.min(1, Math.max(0, -rect.top / pinnedScrollRange)) : 0;
      const maxOffset = Math.max(0, track.scrollWidth - window.innerWidth);
      track.style.transform = `translate3d(${-progress * maxOffset}px, 0, 0)`;
    }

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [prefersReducedMotion]);

  const track = (
    <>
      <div className="flex h-full w-screen shrink-0 flex-col justify-center px-[8vw]">
        <p
          className="mb-14 text-[10px] uppercase text-[#C8A24A]"
          style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.5em' }}
        >
          — The Craft —
        </p>
        <div
          className="text-[clamp(36px,7vw,120px)] leading-[1] tracking-tight text-[#F5F1EA]"
          style={{ fontFamily: 'var(--vision-font-serif)', fontWeight: 300 }}
        >
          Handcrafted,
          <br />
          <em className="italic text-[#F5F1EA]/55">by hand.</em>
        </div>
        <p
          className="mt-10 max-w-[440px] text-sm leading-[1.7] text-[#F5F1EA]/55"
          style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.04em' }}
        >
          {brand.story.values[0].body}
        </p>
      </div>

      {FRAMES.map((frame) => (
        <div key={frame.label} className="h-full w-[min(70vw,640px)] shrink-0 px-6 py-[8vh]">
          <div className="relative h-full overflow-hidden">
            {frame.image ? (
              <>
                <Image src={frame.image} alt="" fill sizes="70vw" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/20" />
              </>
            ) : (
              <>
                <div className="absolute inset-0" style={{ background: frame.background }} />
                <motion.div
                  className="absolute inset-0"
                  style={{ background: frame.glow }}
                  animate={prefersReducedMotion ? undefined : { opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                />
              </>
            )}
            <div
              className="absolute bottom-8 left-8 text-[10px] uppercase text-[#F5F1EA]/60"
              style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
            >
              {frame.label}
            </div>
          </div>
        </div>
      ))}

      <div className="flex h-full w-[min(80vw,720px)] shrink-0 flex-col justify-center px-6">
        <p
          className="max-w-[640px] text-[clamp(22px,3.5vw,44px)] italic leading-[1.3] text-[#F5F1EA]/75"
          style={{ fontFamily: 'var(--vision-font-serif)' }}
        >
          &ldquo;We do not make jewelry to be worn once. We make it to be handed down.&rdquo;
        </p>
        <p
          className="mt-10 text-[11px] uppercase text-[#C8A24A]"
          style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
        >
          — The Atelier
        </p>
      </div>
    </>
  );

  // Reduced motion: no pin, no scroll-jacking — a plain horizontally
  // scrollable strip the user can swipe/drag through at their own pace.
  if (prefersReducedMotion) {
    return (
      <section className="bg-[#08080A] py-24">
        <div className="vision-no-scrollbar flex h-[70vh] gap-0 overflow-x-auto">{track}</div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="relative bg-[#08080A]" style={{ height: `${SCROLL_LENGTH_VH}vh` }}>
      <div className="sticky top-0 h-screen overflow-hidden">
        <div ref={trackRef} className="flex h-full will-change-transform">
          {track}
        </div>
      </div>
    </section>
  );
}
