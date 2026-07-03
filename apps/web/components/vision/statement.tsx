import { ScrollReveal } from '@/components/cinematic/scroll-reveal';

export function VisionStatement() {
  return (
    <section className="flex min-h-[100vh] items-center bg-[#0A0A0C] px-[10vw]">
      <div className="max-w-[1200px]">
        <ScrollReveal>
          <p
            className="mb-16 text-[10px] uppercase text-[#C8A24A]"
            style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.5em' }}
          >
            — Chapter I —
          </p>
          <div
            className="text-[clamp(32px,6.5vw,110px)] leading-[1.1] tracking-tight text-[#F5F1EA]"
            style={{ fontFamily: 'var(--vision-font-serif)', fontWeight: 300 }}
          >
            Some things are not bought.
            <br />
            <em className="italic text-[#F5F1EA]/50">They are inherited.</em>
          </div>
          <div className="mt-20 flex items-baseline gap-8">
            <div className="h-px w-20 bg-[#C8A24A]" />
            <div
              className="text-xs text-[#F5F1EA]/40"
              style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
            >
              EST · 1962
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
