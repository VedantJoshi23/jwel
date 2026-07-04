import Image from 'next/image';
import Link from 'next/link';
import { ScrollReveal } from '@/components/cinematic/scroll-reveal';

export interface CollectionTile {
  slug: string;
  name: string;
  href: string;
  meta: string;
  image?: string;
}

/** Four decorative treatments, cycled by index — purely visual, not tied to
 * any specific category (the 4th slot is always the "Shop all" tile). */
const TILE_STYLES = [
  {
    offset: '',
    background: 'linear-gradient(135deg, #1A1A1E 0%, #0A0A0C 100%)',
    shape: 'radial-gradient(ellipse at 50% 45%, rgba(200,162,74,.35) 0%, transparent 55%)',
    variant: 'ring' as const,
    ring: 'linear-gradient(135deg, #E8CB7B 0%, #8B6D2E 100%)',
  },
  {
    offset: 'md:mt-[120px]',
    background: 'linear-gradient(135deg, #0A1E14 0%, #050A08 100%)',
    shape: 'radial-gradient(ellipse at 40% 60%, rgba(80,180,120,.3) 0%, transparent 55%)',
    variant: 'diamond' as const,
    ring: 'linear-gradient(135deg, #B0F0C8 0%, #3EA060 50%, #0A3020 100%)',
  },
  {
    offset: 'md:-mt-10',
    background: 'linear-gradient(135deg, #0A0A0C 0%, #050508 100%)',
    shape: 'radial-gradient(ellipse at 60% 50%, rgba(239,237,230,.15) 0%, transparent 55%)',
    variant: 'circle' as const,
    ring: 'linear-gradient(135deg, #FFFFFF 0%, #D8D4CE 50%, #807C76 100%)',
  },
  {
    offset: 'md:mt-20',
    background: 'linear-gradient(135deg, #1A1008 0%, #080604 100%)',
    shape: 'radial-gradient(ellipse at 55% 45%, rgba(200,146,133,.3) 0%, transparent 55%)',
    variant: 'band' as const,
    ring: 'linear-gradient(90deg, #C89285 0%, #8B5A50 50%, #4A2A24 100%)',
  },
];

export function VisionCollections({ tiles }: { tiles: CollectionTile[] }) {
  return (
    <section id="collections" className="bg-[rgb(var(--v-bg))] px-[8vw] py-[12vh]">
      <div className="mx-auto max-w-[1400px]">
        <ScrollReveal>
          <p
            className="mb-8 text-[10px] uppercase text-[rgb(var(--v-gold))]"
            style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.5em' }}
          >
            — Shop by Category —
          </p>
          <div
            className="max-w-[900px] text-[clamp(32px,5.5vw,88px)] leading-[1] tracking-tight text-[rgb(var(--v-ink))]"
            style={{ fontFamily: 'var(--vision-font-serif)', fontWeight: 300 }}
          >
            A quiet library of
            <br />
            <em className="italic text-[rgb(var(--v-ink)/0.6)]">wearable heirlooms.</em>
          </div>
        </ScrollReveal>

        <div className="mt-24 grid gap-16 md:grid-cols-2 md:gap-x-14">
          {tiles.map((tile, i) => {
            const style = TILE_STYLES[i % TILE_STYLES.length];
            return (
              <ScrollReveal key={tile.slug} delay={i * 0.08} className={style.offset}>
                <Link href={tile.href} data-vision-magnet className="group block">
                  <div className="relative aspect-[4/5] overflow-hidden" style={{ background: style.background }}>
                    {tile.image && (
                      <Image
                        src={tile.image}
                        alt=""
                        fill
                        sizes="(min-width: 768px) 40vw, 90vw"
                        className="object-cover opacity-70 transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                    )}
                    <div className="absolute inset-0 blur-xl" style={{ background: style.shape }} />
                    {!tile.image && style.variant === 'diamond' && (
                      <div
                        className="absolute left-1/2 top-1/2 h-[35%] w-[35%] -translate-x-1/2 -translate-y-1/2 rotate-45"
                        style={{ background: style.ring, clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)' }}
                      />
                    )}
                    {!tile.image && style.variant === 'circle' && (
                      <div
                        className="absolute left-1/2 top-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{ background: style.ring }}
                      />
                    )}
                    {!tile.image && style.variant === 'band' && (
                      <div
                        className="absolute left-1/2 top-1/2 h-[20%] w-[55%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{ background: style.ring }}
                      />
                    )}
                    {!tile.image && style.variant === 'ring' && (
                      <div
                        className="absolute left-1/2 top-1/2 h-[60%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{ border: '20px solid', borderImage: `${style.ring} 1` }}
                      />
                    )}
                    <div
                      className="absolute left-6 top-6 text-[10px] uppercase text-[#F5F1EA]/50"
                      style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
                    >
                      {`Nº 0${i + 1}`}
                    </div>
                  </div>
                  <div className="mt-8 flex items-baseline justify-between">
                    <div>
                      <div className="text-[32px] leading-none text-[rgb(var(--v-ink))]" style={{ fontFamily: 'var(--vision-font-serif)' }}>
                        {tile.name}
                      </div>
                      <div
                        className="mt-2.5 text-xs uppercase text-[rgb(var(--v-ink)/0.5)]"
                        style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.24em' }}
                      >
                        {tile.meta}
                      </div>
                    </div>
                    <div
                      className="text-[11px] uppercase text-[rgb(var(--v-gold))]"
                      style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
                    >
                      Explore →
                    </div>
                  </div>
                </Link>
              </ScrollReveal>
            );
          })}
        </div>

        <ScrollReveal className="mt-28 text-center">
          <Link
            href="/vision/collections/all"
            data-vision-magnet
            className="inline-block border border-[rgb(var(--v-gold)/0.5)] px-12 py-5 text-xs uppercase text-[rgb(var(--v-ink))] transition-colors hover:border-[rgb(var(--v-gold))] hover:bg-[rgb(var(--v-gold)/0.1)]"
            style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
          >
            Shop the Full Collection →
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}
