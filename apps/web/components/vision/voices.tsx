import { ScrollReveal } from '@/components/cinematic/scroll-reveal';

export function VisionVoices() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050506] px-[8vw]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(200,162,74,.08) 0%, transparent 60%)' }}
      />
      <ScrollReveal className="relative z-[2] max-w-[900px] text-center">
        <p
          className="mb-16 text-[10px] uppercase text-[#C8A24A]"
          style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.5em' }}
        >
          — Voices —
        </p>
        <p
          className="text-[clamp(24px,4vw,56px)] italic leading-[1.4] text-[#F5F1EA]/90"
          style={{ fontFamily: 'var(--vision-font-serif)' }}
        >
          &ldquo;My grandmother wore this piece to her wedding. My mother wore it to hers. I wore
          it to mine. GLINT does not sell jewelry — they sell moments that outlive us.&rdquo;
        </p>
        <p
          className="mt-14 text-[11px] uppercase text-[#C8A24A]"
          style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
        >
          — Anaya M. · Delhi · 2024
        </p>
      </ScrollReveal>
    </section>
  );
}
