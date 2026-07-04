import { Cormorant_Garamond, Manrope } from 'next/font/google';
import { VisionLoader } from '@/components/vision/loader';
import { VisionCursor } from '@/components/vision/cursor';
import { VisionNav } from '@/components/vision/vision-nav';
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

// Read before first paint so a returning visitor who picked "light" doesn't
// see a flash of the dark default. Only ever touches this one data-*
// attribute — never React-managed content — so it can't cause a hydration
// mismatch.
const FOUC_SCRIPT = `(function(){try{var t=localStorage.getItem('vision-theme');if(t==='light'){document.getElementById('main-content').setAttribute('data-vision-theme','light');}}catch(e){}})();`;

export default function VisionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      id="main-content"
      data-vision-theme="dark"
      // The inline script below intentionally mutates this attribute before
      // hydration if localStorage says "light" — that's a deliberate,
      // client-only DOM change React shouldn't try to reconcile (same
      // reasoning as the Grammarly suppressHydrationWarning on <body>).
      suppressHydrationWarning
      className={`${fontSerif.variable} ${fontSans.variable} min-h-screen bg-[rgb(var(--v-bg))] text-[rgb(var(--v-ink))] antialiased [cursor:none]`}
      style={{ fontFamily: 'var(--vision-font-sans)', fontWeight: 300, letterSpacing: '.02em' }}
    >
      {/* eslint-disable-next-line react/no-danger */}
      <script dangerouslySetInnerHTML={{ __html: FOUC_SCRIPT }} />
      <style>{`
        #main-content[data-vision-theme="dark"] {
          --v-bg: 10 10 12; --v-bg-soft: 8 8 10;
          --v-ink: 245 241 234; --v-gold: 200 162 74; --v-gold-soft: 232 203 123;
          --v-border: 245 241 234;
        }
        #main-content[data-vision-theme="light"] {
          --v-bg: 247 243 236; --v-bg-soft: 239 233 221;
          --v-ink: 28 23 16; --v-gold: 156 122 46; --v-gold-soft: 176 138 58;
          --v-border: 28 23 16;
        }
        #main-content { transition: background-color 400ms ease, color 400ms ease; }
        #main-content ::selection { background: rgb(var(--v-gold)); color: rgb(var(--v-bg)); }
        @media (pointer: coarse) { #main-content { cursor: auto; } }
        #main-content .vision-no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        #main-content .vision-no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      <VisionLoader />
      <VisionCursor />
      <VisionNav />

      {children}

      <VisionFooter />
    </div>
  );
}
