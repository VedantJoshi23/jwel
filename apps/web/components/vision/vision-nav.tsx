'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { brand } from '@/lib/brand';
import { ThemeToggle } from './theme-toggle';

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
        background: scrolled ? 'rgb(var(--v-bg) / 0.7)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: `1px solid ${scrolled ? 'rgb(var(--v-gold) / 0.15)' : 'transparent'}`,
      }}
    >
      <Link
        href="/vision"
        className="pl-[0.6em] text-[22px] text-[rgb(var(--v-ink))]"
        style={{ fontFamily: 'var(--vision-font-serif)', letterSpacing: '.6em' }}
      >
        {brand.name}
      </Link>
      <div
        className="hidden gap-11 text-xs uppercase text-[rgb(var(--v-ink))] md:flex"
        style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.24em' }}
      >
        <Link href={`/vision${brand.nav[0].href}`} data-vision-magnet className="py-1.5">
          {brand.nav[0].label}
        </Link>
        <Link href={`/vision${brand.nav[2].href}`} data-vision-magnet className="py-1.5">
          {brand.nav[2].label}
        </Link>
        <Link href="/vision#atelier" data-vision-magnet className="py-1.5">
          Atelier
        </Link>
        <Link href={brand.nav[3].href} data-vision-magnet className="py-1.5">
          {brand.nav[3].label}
        </Link>
      </div>
      <div
        className="flex items-center gap-5 text-xs uppercase text-[rgb(var(--v-ink))]"
        style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.2em' }}
      >
        <Link href="/" data-vision-magnet className="text-[rgb(var(--v-gold))]">
          ← Storefront
        </Link>
        <ThemeToggle />
      </div>
    </nav>
  );
}
