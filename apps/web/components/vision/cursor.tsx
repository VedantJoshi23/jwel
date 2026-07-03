'use client';

import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useEffect, useState } from 'react';

/** Desktop-only magnetic cursor — hidden on touch devices and under reduced-motion. */
export function VisionCursor() {
  const [enabled, setEnabled] = useState(false);
  const [magnet, setMagnet] = useState(false);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, { damping: 30, stiffness: 250 });
  const ringY = useSpring(y, { damping: 30, stiffness: 250 });

  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (coarse || reduced) return;
    setEnabled(true);

    function handleMove(e: MouseEvent) {
      x.set(e.clientX);
      y.set(e.clientY);
      const target = (e.target as HTMLElement)?.closest('[data-vision-magnet]');
      setMagnet(!!target);
    }
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, [x, y]);

  if (!enabled) return null;

  return (
    <>
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-[210] h-1.5 w-1.5 rounded-full bg-[#E8CB7B]"
        style={{ x, y, translateX: '-50%', translateY: '-50%', mixBlendMode: 'difference' }}
      />
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-[209] rounded-full border"
        animate={{
          width: magnet ? 60 : 36,
          height: magnet ? 60 : 36,
          borderColor: magnet ? '#E8CB7B' : 'rgba(200,162,74,.5)',
          backgroundColor: magnet ? 'rgba(200,162,74,.08)' : 'rgba(0,0,0,0)',
        }}
        transition={{ duration: 0.3 }}
        style={{ x: ringX, y: ringY, translateX: '-50%', translateY: '-50%' }}
      />
    </>
  );
}
