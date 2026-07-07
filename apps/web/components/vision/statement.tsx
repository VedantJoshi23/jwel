import { ScrollReveal } from '@/components/cinematic/scroll-reveal';
import { brand } from '@/lib/brand';

export function VisionStatement() {
  return (
    <section className="flex min-h-[100vh] items-center bg-[rgb(var(--v-bg))] px-[10vw]">
      <div className="max-w-[1200px]">
        <ScrollReveal>
          <p
            className="mb-16 text-[10px] uppercase text-[rgb(var(--v-gold))]"
            style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.5em' }}
          >
            — Chapter I —
          </p>
          <div
            className="text-[clamp(32px,6.5vw,110px)] leading-[1.1] tracking-tight text-[rgb(var(--v-ink))]"
            style={{ fontFamily: 'var(--vision-font-serif)', fontWeight: 300 }}
          >
            Some things are not bought.
            <br />
            <em className="italic text-[rgb(var(--v-ink)/0.5)]">They are inherited.</em>
          </div>
          <div className="mt-20 flex items-baseline gap-8">
            <div className="h-px w-20 bg-[rgb(var(--v-gold))]" />
            <div
              className="text-xs uppercase text-[rgb(var(--v-ink)/0.4)]"
              style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
            >
              — {brand.tagline} —
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
