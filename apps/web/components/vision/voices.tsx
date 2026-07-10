import { ScrollReveal } from '@/components/cinematic/scroll-reveal';
import { brand } from '@/lib/brand';

export function VisionVoices() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[rgb(var(--v-bg))] px-[8vw]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, rgb(var(--v-gold) / 0.08) 0%, transparent 60%)' }}
      />
      <ScrollReveal className="relative z-[2] max-w-[900px] text-center">
        <p
          className="mb-16 text-[10px] uppercase text-[rgb(var(--v-gold))]"
          style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.5em' }}
        >
          — Voices —
        </p>
        <p
          className="text-[clamp(24px,4vw,56px)] italic leading-[1.4] text-[rgb(var(--v-ink)/0.9)]"
          style={{ fontFamily: 'var(--vision-font-serif)' }}
        >
          &ldquo;This is jewelry I actually reach for — for the wedding, and for the ordinary
          Tuesday after it. That&rsquo;s the whole idea.&rdquo;
        </p>
        <p
          className="mt-14 text-[11px] uppercase text-[rgb(var(--v-gold))]"
          style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
        >
          — A {brand.name} customer
        </p>
      </ScrollReveal>
    </section>
  );
}
