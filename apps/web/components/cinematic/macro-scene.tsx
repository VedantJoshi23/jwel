'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';

interface MacroSceneProps {
  image: string;
  eyebrow: string;
  headline: string;
}

/** Full-bleed editorial band — the "craftsmanship close-up" beat between product sections. */
export function MacroScene({ image, eyebrow, headline }: MacroSceneProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="relative flex h-[60vh] min-h-[420px] items-center justify-center overflow-hidden bg-footer-bg">
      <Image src={image} alt="" fill sizes="100vw" className="object-cover opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-t from-footer-bg via-footer-bg/40 to-footer-bg/10" />
      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative px-6 text-center"
      >
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-footer-accent">{eyebrow}</p>
        <h2 className="whitespace-pre-line font-display text-3xl font-bold tracking-tight text-white lg:text-5xl">
          {headline}
        </h2>
      </motion.div>
    </section>
  );
}
