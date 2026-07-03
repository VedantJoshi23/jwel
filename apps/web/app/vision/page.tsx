import type { Metadata } from 'next';
import { Cormorant_Garamond, Manrope } from 'next/font/google';
import { VisionLoader } from '@/components/vision/loader';
import { VisionCursor } from '@/components/vision/cursor';
import { VisionNav } from '@/components/vision/vision-nav';
import { VisionHero } from '@/components/vision/hero';
import { VisionStatement } from '@/components/vision/statement';
import { VisionCraft } from '@/components/vision/craft';
import { GemChapter } from '@/components/vision/gem-chapter';
import { VisionCollections } from '@/components/vision/collections';
import { VisionVoices } from '@/components/vision/voices';
import { VisionAtelier } from '@/components/vision/atelier';
import { VisionFooter } from '@/components/vision/vision-footer';

// Scoped to this route only — the real storefront keeps Fraunces/Inter
// (tailwind.config.ts, app/globals.css). Nothing here touches those tokens.
const fontSerif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  variable: '--vision-font-serif',
});
const fontSans = Manrope({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600'],
  variable: '--vision-font-sans',
});

export const metadata: Metadata = {
  title: 'GLINT — Crafted to become timeless. (Vision Concept)',
  description:
    'An unlisted concept pitch: a cinematic, editorial direction for GLINT — not the live storefront.',
  robots: { index: false, follow: false },
};

export default function VisionPage() {
  return (
    <div
      id="main-content"
      className={`${fontSerif.variable} ${fontSans.variable} min-h-screen bg-[#0A0A0C] text-[#F5F1EA] antialiased [cursor:none]`}
      style={{ fontFamily: 'var(--vision-font-sans)', fontWeight: 300, letterSpacing: '.02em' }}
    >
      <style>{`
        #main-content ::selection { background: #C8A24A; color: #0A0A0C; }
        @media (pointer: coarse) { #main-content { cursor: auto; } }
        #main-content .vision-no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        #main-content .vision-no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      <VisionLoader />
      <VisionCursor />
      <VisionNav />

      <VisionHero />
      <VisionStatement />
      <VisionCraft />

      <GemChapter
        align="left"
        background="linear-gradient(180deg, #08080A 0%, #0A1E14 30%, #0F3D2E 60%, #0A1E14 100%)"
        wash="radial-gradient(ellipse at center, transparent 30%, rgba(10,30,20,.6) 100%)"
        accent="#8FBFA0"
        eyebrow="— Chapter II · Emerald —"
        headline={
          <>
            Born of
            <br />
            <em className="italic text-[#8FBFA0]">the earth,</em>
            <br />
            cut for
            <br />
            <em className="italic text-[#8FBFA0]">the light.</em>
          </>
        }
        body="Colombian in origin. Cut to precisely 58 facets to catch light the way a river catches morning. No two are identical — nor should they be."
        stats={[
          { value: '2.4', unit: 'ct', label: 'Carat' },
          { value: '58', label: 'Facets' },
          { value: 'VVS', unit: '1', label: 'Clarity' },
        ]}
        gem={{
          position: 'right-[8vw] top-1/2 -translate-y-1/2',
          size: 'h-[min(55vh,460px)] w-[min(55vh,460px)]',
          glow: 'radial-gradient(circle, #6FE0A0 0%, #1A6B45 35%, transparent 70%)',
          shapeGradient: 'linear-gradient(135deg, #C8F5D8 0%, #4FBF80 45%, #0A3020 100%)',
          clipPath: 'polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)',
        }}
      />

      <GemChapter
        align="right"
        background="linear-gradient(180deg, #0A1E14 0%, #1A0508 20%, #4A0A15 55%, #1A0508 100%)"
        wash="radial-gradient(ellipse at 70% 40%, rgba(200,50,60,.35) 0%, transparent 45%)"
        accent="#E88090"
        eyebrow="— Chapter III · Ruby —"
        headline={
          <>
            The color
            <br />
            <em className="italic text-[#E88090]">of memory.</em>
          </>
        }
        body="Burmese pigeon-blood ruby. Fewer than 200 stones of this grade exist worldwide. Each carries a certificate — and, we like to think, a soul."
        gem={{
          position: 'left-[8vw] top-1/2 -translate-y-1/2',
          size: 'h-[min(50vh,420px)] w-[min(50vh,420px)]',
          glow: 'radial-gradient(circle, #FF6B7A 0%, #C8202E 25%, transparent 70%)',
          shapeGradient: 'linear-gradient(135deg, #FFB0BC 0%, #E82030 35%, #8B0A18 70%, #3A0508 100%)',
          clipPath: 'polygon(50% 5%, 80% 30%, 90% 65%, 50% 95%, 10% 65%, 20% 30%)',
        }}
      />

      <GemChapter
        align="right"
        background="linear-gradient(180deg, #1A0508 0%, #050820 25%, #0E1F4A 60%, #050820 100%)"
        wash="radial-gradient(ellipse at 30% 60%, rgba(60,120,220,.35) 0%, transparent 50%)"
        accent="#8FA8E8"
        eyebrow="— Chapter IV · Sapphire —"
        headline={
          <>
            Depth
            <br />
            <em className="italic text-[#8FA8E8]">as pigment.</em>
          </>
        }
        body="Kashmir cornflower blue. A shade so specific there are only three words for it — and all of them mean the same sky."
        gem={{
          position: 'left-[12vw] top-1/2 -translate-y-1/2',
          size: 'h-[min(48vh,400px)] w-[min(48vh,400px)]',
          glow: 'radial-gradient(circle, #8FB0FF 0%, #2050C8 25%, transparent 70%)',
          shapeGradient: 'linear-gradient(135deg, #B0C8FF 0%, #3060E8 40%, #0A2080 75%, #050530 100%)',
          clipPath: 'polygon(30% 0, 70% 0, 100% 40%, 80% 100%, 20% 100%, 0 40%)',
          rotate: 'rotate(15deg)',
        }}
      />

      <VisionCollections />
      <VisionVoices />
      <VisionAtelier />
      <VisionFooter />
    </div>
  );
}
