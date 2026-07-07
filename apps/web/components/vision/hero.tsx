'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { brand } from '@/lib/brand';
import { ParticleField } from './particle-field';

const heroTextTransition = { duration: 1, ease: [0.16, 1, 0.3, 1] as const };

export function VisionHero() {
  const prefersReducedMotion = useReducedMotion();
  const hero = brand.hero;

  return (
    <section
      className="relative flex h-screen items-center justify-center overflow-hidden text-center"
      style={{ background: 'radial-gradient(ellipse at center, rgb(var(--v-bg-soft)) 0%, rgb(var(--v-bg)) 60%, rgb(var(--v-bg-soft) / 0.6) 100%)' }}
    >
      <ParticleField className="absolute inset-0 h-full w-full opacity-85" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 60%, rgb(var(--v-gold) / 0.06) 0%, transparent 50%)' }}
      />

      <div className="relative z-[2] flex flex-col items-center px-[8vw]">
        <motion.p
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...heroTextTransition, delay: 0.2 }}
          className="mb-9 text-[11px] uppercase text-[rgb(var(--v-gold))]"
          style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.6em' }}
        >
          — Handcrafted, heirloom-worthy —
        </motion.p>

        <motion.h1
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...heroTextTransition, delay: 0.4 }}
          className="text-[clamp(48px,10vw,180px)] leading-[0.95] tracking-tight text-[rgb(var(--v-ink))]"
          style={{ fontFamily: 'var(--vision-font-serif)', fontWeight: 300 }}
        >
          Crafted to become
          <br />
          <em
            className="not-italic"
            style={{
              fontStyle: 'italic',
              background: 'linear-gradient(135deg, rgb(var(--v-gold-soft)) 0%, rgb(var(--v-gold)) 50%, rgb(var(--v-gold) / 0.7) 100%)',
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
          className="mt-12 max-w-[520px] text-sm leading-[1.7] text-[rgb(var(--v-ink)/0.6)]"
          style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.06em' }}
        >
          {hero.subtext}
        </motion.p>

        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...heroTextTransition, delay: 0.8 }}
          className="mt-11 flex flex-wrap items-center justify-center gap-5"
        >
          <Link
            href={`/vision${hero.primaryCtaHref}`}
            data-vision-magnet
            className="inline-block bg-[rgb(var(--v-gold))] px-8 py-3.5 text-xs uppercase tracking-[.3em] text-[rgb(var(--v-bg))] transition-transform duration-300 hover:scale-[1.03]"
          >
            {hero.primaryCta}
          </Link>
          <Link
            href={`/vision${hero.secondaryCtaHref}`}
            data-vision-magnet
            className="inline-block border border-[rgb(var(--v-gold)/0.5)] px-8 py-3.5 text-xs uppercase tracking-[.3em] text-[rgb(var(--v-ink))] transition-colors duration-300 hover:border-[rgb(var(--v-gold))]"
          >
            {hero.secondaryCta}
          </Link>
        </motion.div>
      </div>

      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ...heroTextTransition, delay: 1.1 }}
        className="absolute bottom-12 left-1/2 z-[3] flex -translate-x-1/2 flex-col items-center gap-3.5"
      >
        <div
          className="text-[10px] uppercase text-[rgb(var(--v-ink)/0.5)]"
          style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
        >
          Scroll to discover
        </div>
        <div className="h-[60px] w-px" style={{ background: 'linear-gradient(180deg, rgb(var(--v-gold)) 0%, transparent 100%)' }} />
      </motion.div>
    </section>
  );
}
