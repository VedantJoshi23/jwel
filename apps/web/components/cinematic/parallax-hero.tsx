'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useRef } from 'react';
import { heroImage } from '@/lib/jewellery-images';

interface ParallaxHeroProps {
  headline: string;
  subtext: string;
  primaryCta: string;
  primaryCtaHref: string;
}

const brandEyebrow = 'Handcrafted, heirloom-worthy';

export function ParallaxHero({ headline, subtext, primaryCta, primaryCtaHref }: ParallaxHeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] });

  // Image drifts slower than scroll (parallax); fades out as the viewer scrolls past.
  const imageY = useTransform(scrollYProgress, [0, 1], prefersReducedMotion ? [0, 0] : [0, 160]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 1], [0.45, 0.75]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section ref={sectionRef} className="relative h-[92vh] min-h-[560px] overflow-hidden bg-footer-bg">
      <motion.div style={{ y: imageY }} className="absolute inset-0 -top-10">
        <Image src={heroImage} alt="" fill priority sizes="100vw" className="object-cover" />
      </motion.div>
      <motion.div className="absolute inset-0 bg-footer-bg" style={{ opacity: overlayOpacity }} />

      <motion.div
        style={{ opacity: prefersReducedMotion ? 1 : textOpacity }}
        className="relative flex h-full flex-col items-center justify-center px-6 text-center"
      >
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mb-4 font-mono text-xs uppercase tracking-widest text-footer-accent"
        >
          {brandEyebrow}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="whitespace-pre-line font-display text-5xl font-bold leading-[1.05] tracking-tight text-white lg:text-7xl"
        >
          {headline}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45 }}
          className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-footer-ink/90"
        >
          {subtext}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="mt-9"
        >
          <Link
            href={primaryCtaHref}
            className="inline-block bg-brand-accent px-8 py-3.5 text-sm font-semibold text-footer-bg transition-transform duration-300 hover:scale-[1.03]"
          >
            {primaryCta}
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
