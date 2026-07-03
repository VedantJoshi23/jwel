'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export function VisionNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 60);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-between transition-[background,padding,border-color] duration-500"
      style={{
        padding: scrolled ? '18px 56px' : '28px 56px',
        background: scrolled ? 'rgba(10,10,12,.7)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: `1px solid ${scrolled ? 'rgba(200,162,74,.15)' : 'transparent'}`,
      }}
    >
      <div
        className="pl-[0.6em] text-[22px] text-[#F5F1EA]"
        style={{ fontFamily: 'var(--vision-font-serif)', letterSpacing: '.6em' }}
      >
        GLINT
      </div>
      <div
        className="hidden gap-11 text-xs uppercase text-[#F5F1EA] md:flex"
        style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.24em' }}
      >
        <span data-vision-magnet className="cursor-pointer py-1.5">
          The Film
        </span>
        <span data-vision-magnet className="cursor-pointer py-1.5">
          Collection
        </span>
        <span data-vision-magnet className="cursor-pointer py-1.5">
          Atelier
        </span>
        <span data-vision-magnet className="cursor-pointer py-1.5">
          Journal
        </span>
      </div>
      <div
        className="flex items-center gap-6 text-xs uppercase text-[#F5F1EA]"
        style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.2em' }}
      >
        <Link href="/" data-vision-magnet className="text-[#C8A24A]">
          ← Storefront
        </Link>
      </div>
    </nav>
  );
}
