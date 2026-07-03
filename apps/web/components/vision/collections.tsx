'use client';

import { ScrollReveal } from '@/components/cinematic/scroll-reveal';

const COLLECTIONS = [
  {
    n: 'Nº 01',
    name: 'Meridian',
    meta: 'Everyday Gold · 24 pieces',
    offset: '',
    background: 'linear-gradient(135deg, #1A1A1E 0%, #0A0A0C 100%)',
    shape: {
      background: 'radial-gradient(ellipse at 50% 45%, rgba(200,162,74,.35) 0%, transparent 55%)',
    },
    ring: 'linear-gradient(135deg, #E8CB7B 0%, #8B6D2E 100%)',
  },
  {
    n: 'Nº 02',
    name: 'Aurora',
    meta: 'Emerald Edition · 12 pieces',
    offset: 'md:mt-[120px]',
    background: 'linear-gradient(135deg, #0A1E14 0%, #050A08 100%)',
    shape: {
      background: 'radial-gradient(ellipse at 40% 60%, rgba(80,180,120,.3) 0%, transparent 55%)',
    },
    ring: 'linear-gradient(135deg, #B0F0C8 0%, #3EA060 50%, #0A3020 100%)',
    diamond: true,
  },
  {
    n: 'Nº 03',
    name: 'Vault',
    meta: 'High Jewelry · 8 pieces',
    offset: 'md:-mt-10',
    background: 'linear-gradient(135deg, #0A0A0C 0%, #050508 100%)',
    shape: {
      background: 'radial-gradient(ellipse at 60% 50%, rgba(239,237,230,.15) 0%, transparent 55%)',
    },
    ring: 'linear-gradient(135deg, #FFFFFF 0%, #D8D4CE 50%, #807C76 100%)',
    circle: true,
  },
  {
    n: 'Nº 04',
    name: 'Heirloom',
    meta: 'Rose Gold · 18 pieces',
    offset: 'md:mt-20',
    background: 'linear-gradient(135deg, #1A1008 0%, #080604 100%)',
    shape: {
      background: 'radial-gradient(ellipse at 55% 45%, rgba(200,146,133,.3) 0%, transparent 55%)',
    },
    ring: 'linear-gradient(90deg, #C89285 0%, #8B5A50 50%, #4A2A24 100%)',
    band: true,
  },
];

export function VisionCollections() {
  return (
    <section className="bg-[#0A0A0C] px-[8vw] py-[12vh]">
      <div className="mx-auto max-w-[1400px]">
        <ScrollReveal>
          <p
            className="mb-8 text-[10px] uppercase text-[#C8A24A]"
            style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.5em' }}
          >
            — Four Collections —
          </p>
          <div
            className="max-w-[900px] text-[clamp(32px,5.5vw,88px)] leading-[1] tracking-tight text-[#F5F1EA]"
            style={{ fontFamily: 'var(--vision-font-serif)', fontWeight: 300 }}
          >
            A quiet library of
            <br />
            <em className="italic text-[#F5F1EA]/60">wearable heirlooms.</em>
          </div>
        </ScrollReveal>

        <div className="mt-24 grid gap-16 md:grid-cols-2 md:gap-x-14">
          {COLLECTIONS.map((c, i) => (
            <ScrollReveal key={c.name} delay={i * 0.08} className={c.offset}>
              <div className="group cursor-pointer" data-vision-magnet>
                <div className="relative aspect-[4/5] overflow-hidden" style={{ background: c.background }}>
                  <div className="absolute inset-0 blur-xl" style={c.shape} />
                  {c.diamond && (
                    <div
                      className="absolute left-1/2 top-1/2 h-[35%] w-[35%] -translate-x-1/2 -translate-y-1/2 rotate-45"
                      style={{ background: c.ring, clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)' }}
                    />
                  )}
                  {c.circle && (
                    <div
                      className="absolute left-1/2 top-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{ background: c.ring }}
                    />
                  )}
                  {c.band && (
                    <div
                      className="absolute left-1/2 top-1/2 h-[20%] w-[55%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{ background: c.ring }}
                    />
                  )}
                  {!c.diamond && !c.circle && !c.band && (
                    <div
                      className="absolute left-1/2 top-1/2 h-[60%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{ border: '20px solid', borderImage: `${c.ring} 1` }}
                    />
                  )}
                  <div
                    className="absolute left-6 top-6 text-[10px] uppercase text-[#F5F1EA]/50"
                    style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
                  >
                    {c.n}
                  </div>
                </div>
                <div className="mt-8 flex items-baseline justify-between">
                  <div>
                    <div className="text-[32px] leading-none text-[#F5F1EA]" style={{ fontFamily: 'var(--vision-font-serif)' }}>
                      {c.name}
                    </div>
                    <div
                      className="mt-2.5 text-xs uppercase text-[#F5F1EA]/50"
                      style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.24em' }}
                    >
                      {c.meta}
                    </div>
                  </div>
                  <div
                    className="text-[11px] uppercase text-[#C8A24A]"
                    style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
                  >
                    Explore →
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal className="mt-28 text-center">
          <div
            data-vision-magnet
            className="inline-block cursor-pointer border border-[#C8A24A]/50 px-12 py-5 text-xs uppercase text-[#F5F1EA] transition-colors hover:border-[#C8A24A] hover:bg-[#C8A24A]/10"
            style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
          >
            Enter the Collection →
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
