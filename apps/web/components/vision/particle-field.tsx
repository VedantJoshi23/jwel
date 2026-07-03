'use client';

import { useEffect, useRef } from 'react';

interface ParticleFieldProps {
  className?: string;
  count?: number;
}

/** Drifting gold dust — plain 2D canvas, no WebGL/Three.js needed for this effect. */
export function ParticleField({ className, count = 120 }: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame: number;
    const dpr = Math.min(window.devicePixelRatio, 2);

    function resize() {
      canvas!.width = canvas!.clientWidth * dpr;
      canvas!.height = canvas!.clientHeight * dpr;
    }
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.4 + 0.3,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.1 - 0.05,
      a: Math.random() * 0.6 + 0.2,
      phase: Math.random() * Math.PI * 2,
    }));

    let t = 0;
    function loop() {
      t += 0.01;
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas!.width;
        if (p.x > canvas!.width) p.x = 0;
        if (p.y < 0) p.y = canvas!.height;
        if (p.y > canvas!.height) p.y = 0;
        const flicker = 0.5 + 0.5 * Math.sin(t * 2 + p.phase);
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r * dpr, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(232,203,123,${p.a * flicker})`;
        ctx!.fill();
      }
      frame = requestAnimationFrame(loop);
    }
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [count]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
