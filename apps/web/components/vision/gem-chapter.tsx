import type { ReactNode } from 'react';
import Link from 'next/link';
import { ScrollReveal } from '@/components/cinematic/scroll-reveal';

interface GemStat {
  value: string;
  unit?: string;
  label: string;
}

interface GemVisual {
  /** Tailwind position classes for the gem's absolute wrapper, e.g. "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2". */
  position: string;
  size: string;
  glow: string;
  shapeGradient: string;
  clipPath: string;
  rotate?: string;
}

interface GemChapterProps {
  background: string;
  wash: string;
  accent: string;
  eyebrow: string;
  headline: ReactNode;
  body: string;
  stats?: GemStat[];
  align: 'left' | 'right';
  gem: GemVisual;
  href: string;
  ctaLabel: string;
}

/** One of the three "gemstone chapter" scenes — Emerald / Ruby / Sapphire — sharing
 * layout and motion, differing only in palette, copy, and the CSS-only gem shape
 * (no WebGL/Three.js — a flat clip-path + radial glow reads just as well at this
 * scale and keeps this pitch page dependency-free). */
export function GemChapter({ background, wash, accent, eyebrow, headline, body, stats, align, gem, href, ctaLabel }: GemChapterProps) {
  return (
    <section className="relative min-h-[110vh] overflow-hidden" style={{ background }}>
      <div className="pointer-events-none absolute inset-0" style={{ background: wash }} />

      <div className={`absolute ${gem.position} ${gem.size}`} style={{ opacity: 0.9 }}>
        <div
          className="absolute inset-0 rounded-full blur-2xl"
          style={{ background: gem.glow }}
        />
        <div
          className="absolute inset-[15%]"
          style={{ background: gem.shapeGradient, clipPath: gem.clipPath, transform: gem.rotate }}
        />
      </div>

      <div
        className={`relative z-[2] flex min-h-[110vh] items-center px-[8vw] ${align === 'right' ? 'justify-end' : ''}`}
      >
        <div className={`max-w-[520px] ${align === 'right' ? 'text-right' : ''}`}>
          <ScrollReveal>
            <p
              className="mb-10 text-[10px] uppercase"
              style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.5em', color: accent }}
            >
              {eyebrow}
            </p>
            <div
              className="text-[clamp(36px,6.5vw,110px)] leading-[1] tracking-tight text-[#F5F1EA]"
              style={{ fontFamily: 'var(--vision-font-serif)', fontWeight: 300 }}
            >
              {headline}
            </div>
            <p
              className="mt-12 text-sm leading-[1.8] text-[#F5F1EA]/65"
              style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.04em' }}
            >
              {body}
            </p>
            {stats && (
              <div className={`mt-14 flex gap-14 ${align === 'right' ? 'justify-end' : ''}`}>
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <div className="text-[32px] leading-none text-[#F5F1EA]" style={{ fontFamily: 'var(--vision-font-serif)' }}>
                      {stat.value}
                      {stat.unit && <span className="text-[0.6em] text-[#F5F1EA]/50">{stat.unit}</span>}
                    </div>
                    <div
                      className="mt-2 text-[10px] uppercase text-[#F5F1EA]/50"
                      style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
                    >
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link
              href={href}
              data-vision-magnet
              className={`mt-12 inline-block text-[11px] uppercase tracking-[.4em] text-[#F5F1EA] underline decoration-[#F5F1EA]/40 underline-offset-8 transition-colors hover:decoration-[#F5F1EA] ${align === 'right' ? 'text-right' : ''}`}
            >
              {ctaLabel}
            </Link>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
