'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ParticleField } from './particle-field';

const heroTextTransition = { duration: 1, ease: [0.16, 1, 0.3, 1] as const };

export function VisionHero() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      className="relative flex h-screen items-center justify-center overflow-hidden text-center"
      style={{ background: 'radial-gradient(ellipse at center, #141416 0%, #0A0A0C 60%, #050506 100%)' }}
    >
      <ParticleField className="absolute inset-0 h-full w-full opacity-85" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 60%, rgba(200,162,74,.06) 0%, transparent 50%)' }}
      />

      <div className="relative z-[2] flex flex-col items-center px-[8vw]">
        <motion.p
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...heroTextTransition, delay: 0.2 }}
          className="mb-9 text-[11px] uppercase text-[#C8A24A]"
          style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.6em' }}
        >
          — The Aurora Collection · 2026 —
        </motion.p>

        <motion.h1
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...heroTextTransition, delay: 0.4 }}
          className="text-[clamp(48px,10vw,180px)] leading-[0.95] tracking-tight text-[#F5F1EA]"
          style={{ fontFamily: 'var(--vision-font-serif)', fontWeight: 300 }}
        >
          Crafted to become
          <br />
          <em
            className="not-italic"
            style={{
              fontStyle: 'italic',
              background: 'linear-gradient(135deg, #E8CB7B 0%, #C8A24A 50%, #8B6D2E 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            timeless.
          </em>
        </motion.h1>

        <motion.p
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...heroTextTransition, delay: 0.6 }}
          className="mt-12 max-w-[520px] text-sm leading-[1.7] text-[#F5F1EA]/60"
          style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.06em' }}
        >
          Since 1962, GLINT has crafted heirloom-grade jewelry by hand in Jaipur — one piece, one
          story, one lifetime at a time.
        </motion.p>
      </div>

      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ...heroTextTransition, delay: 1 }}
        className="absolute bottom-12 left-1/2 z-[3] flex -translate-x-1/2 flex-col items-center gap-3.5"
      >
        <div
          className="text-[10px] uppercase text-[#F5F1EA]/50"
          style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
        >
          Scroll to discover
        </div>
        <div className="h-[60px] w-px" style={{ background: 'linear-gradient(180deg, #C8A24A 0%, transparent 100%)' }} />
      </motion.div>
    </section>
  );
}
