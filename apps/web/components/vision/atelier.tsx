import Image from 'next/image';
import Link from 'next/link';
import { ScrollReveal } from '@/components/cinematic/scroll-reveal';
import { brand } from '@/lib/brand';
import { atelierPortraitImage } from './images';

export function VisionAtelier() {
  return (
    <section id="atelier" className="bg-[rgb(var(--v-bg))] px-[8vw] py-[12vh]">
      <div className="mx-auto grid max-w-[1400px] items-center gap-[8vw] md:grid-cols-2">
        {/* Portrait stays a fixed dark/immersive treatment in both themes,
            same as craft.tsx's photo frames — the caption sits on the photo,
            not the page background, so it keeps its hardcoded light color. */}
        <ScrollReveal>
          <div className="relative aspect-[3/4] overflow-hidden">
            <Image src={atelierPortraitImage} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(0deg, rgba(10,10,12,.75) 0%, transparent 40%)' }}
            />
            <div
              className="absolute bottom-8 left-8 text-[10px] uppercase text-[#F5F1EA]/70"
              style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
            >
              Handcrafted, piece by piece
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <p
            className="mb-10 text-[10px] uppercase text-[rgb(var(--v-gold))]"
            style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.5em' }}
          >
            — The Atelier —
          </p>
          <div
            className="text-[clamp(32px,5vw,80px)] leading-[1] tracking-tight text-[rgb(var(--v-ink))]"
            style={{ fontFamily: 'var(--vision-font-serif)', fontWeight: 300 }}
          >
            Our story,
            <br />
            told by hand.
          </div>
          <p
            className="mt-10 max-w-[480px] text-[15px] leading-[1.9] text-[rgb(var(--v-ink)/0.7)]"
            style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.03em' }}
          >
            {brand.story.intro}
          </p>

          <div className="mt-10 grid max-w-[480px] gap-6 sm:grid-cols-3">
            {brand.story.values.map((v) => (
              <div key={v.title}>
                <div
                  className="text-xs uppercase text-[rgb(var(--v-ink))]"
                  style={{ fontFamily: 'var(--vision-font-sans)', fontWeight: 600, letterSpacing: '.1em' }}
                >
                  {v.title}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[rgb(var(--v-ink)/0.6)]">{v.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-wrap gap-6">
            <Link
              href="/vision/collections/all"
              data-vision-magnet
              className="bg-[rgb(var(--v-gold))] px-10 py-5 text-xs uppercase text-[rgb(var(--v-bg))]"
              style={{ fontFamily: 'var(--vision-font-sans)', fontWeight: 500, letterSpacing: '.4em' }}
            >
              Shop the collection
            </Link>
            <Link
              href="/about"
              data-vision-magnet
              className="border border-[rgb(var(--v-ink)/0.3)] px-10 py-5 text-xs uppercase text-[rgb(var(--v-ink))]"
              style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
            >
              Our story
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
