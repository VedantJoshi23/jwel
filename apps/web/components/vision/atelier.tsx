import Image from 'next/image';
import { ScrollReveal } from '@/components/cinematic/scroll-reveal';
import { atelierPortraitImage } from './images';

export function VisionAtelier() {
  return (
    <section className="bg-[#0A0A0C] px-[8vw] py-[12vh]">
      <div className="mx-auto grid max-w-[1400px] items-center gap-[8vw] md:grid-cols-2">
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
              Portrait · Rajkumar Soni · Master Craftsman
            </div>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={0.15}>
          <p
            className="mb-10 text-[10px] uppercase text-[#C8A24A]"
            style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.5em' }}
          >
            — The Atelier —
          </p>
          <div
            className="text-[clamp(32px,5vw,80px)] leading-[1] tracking-tight text-[#F5F1EA]"
            style={{ fontFamily: 'var(--vision-font-serif)', fontWeight: 300 }}
          >
            A quiet workshop
            <br />
            in Old Jaipur.
          </div>
          <p
            className="mt-10 max-w-[480px] text-[15px] leading-[1.9] text-[#F5F1EA]/70"
            style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.03em' }}
          >
            Founded in 1962 by a single goldsmith, GLINT has remained deliberately small. Fourteen
            artisans. Nine looms. One workshop. We make roughly 400 pieces a year — no more.
            Everything is signed by the hand that finished it.
          </p>
          <div className="mt-14 flex flex-wrap gap-6">
            <div
              data-vision-magnet
              className="cursor-pointer bg-[#C8A24A] px-10 py-5 text-xs uppercase text-[#0A0A0C]"
              style={{ fontFamily: 'var(--vision-font-sans)', fontWeight: 500, letterSpacing: '.4em' }}
            >
              Book a private viewing
            </div>
            <div
              data-vision-magnet
              className="cursor-pointer border border-[#F5F1EA]/30 px-10 py-5 text-xs uppercase text-[#F5F1EA]"
              style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
            >
              Our story
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
