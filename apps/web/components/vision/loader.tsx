'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { brand } from '@/lib/brand';
import { ParticleField } from './particle-field';

export function VisionLoader() {
  const [visible, setVisible] = useState(true);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const timeout = setTimeout(() => setVisible(false), prefersReducedMotion ? 0 : 1400);
    return () => clearTimeout(timeout);
  }, [prefersReducedMotion]);

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-8 bg-[rgb(var(--v-bg))]"
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.9, ease: [0.65, 0.05, 0.36, 1] }}
      style={{ pointerEvents: visible ? 'auto' : 'none' }}
      aria-hidden={!visible}
    >
      <ParticleField className="absolute inset-0 h-full w-full" count={60} />
      <div className="relative h-[120px] w-[120px]">
        <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
          <circle cx="60" cy="60" r="45" fill="none" stroke="rgb(var(--v-gold) / 0.15)" strokeWidth="1" />
          <motion.circle
            cx="60"
            cy="60"
            r="45"
            fill="none"
            stroke="rgb(var(--v-gold))"
            strokeWidth="1"
            strokeDasharray={283}
            initial={{ strokeDashoffset: 283 }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 1.2, ease: [0.65, 0.05, 0.36, 1] }}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center pl-2 text-[22px] text-[rgb(var(--v-gold-soft))]"
          style={{ fontFamily: 'var(--vision-font-serif)', letterSpacing: '.5em' }}
        >
          {brand.name.charAt(0)}
        </div>
      </div>
      <div
        className="text-[10px] uppercase text-[rgb(var(--v-ink)/0.4)]"
        style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.5em' }}
      >
        {brand.tagline}
      </div>
    </motion.div>
  );
}
