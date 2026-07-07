import Link from 'next/link';
import { brand } from '@/lib/brand';

const COLUMNS = [
  {
    title: 'Shop',
    links: brand.homeCategories.map((c) => ({ label: c.name, href: `/vision/collections/${c.slug}` })),
  },
  {
    title: 'Atelier',
    links: [
      { label: 'Our story', href: '/about' },
      { label: 'Subscriptions', href: '/subscriptions' },
      { label: 'Temple Jewelry', href: '/vision/collections/temple-jewelry' },
    ],
  },
  {
    title: 'Service',
    links: brand.footer.helpLinks.filter((l) => l.href !== '#').map((l) => ({ label: l.label, href: l.href })),
  },
];

export function VisionFooter() {
  return (
    <footer className="overflow-x-hidden border-t border-[rgb(var(--v-gold)/0.15)] bg-[rgb(var(--v-bg))] px-[8vw] pb-12 pt-[120px]">
      <div className="mx-auto max-w-[1400px]">
        <div className="text-center">
          <div
            className="pl-[0.6em] text-[clamp(56px,14vw,240px)] leading-none"
            style={{
              fontFamily: 'var(--vision-font-serif)',
              fontWeight: 400,
              letterSpacing: '.6em',
              background: 'linear-gradient(180deg, rgb(var(--v-ink)) 0%, rgb(var(--v-ink) / 0.2) 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {brand.name}
          </div>
          <div
            className="mt-6 text-xs uppercase text-[rgb(var(--v-gold))]"
            style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.5em' }}
          >
            — {brand.tagline} —
          </div>
        </div>

        <div className="mt-24 grid gap-16 border-t border-[rgb(var(--v-ink)/0.08)] pt-20 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <p
              className="max-w-[340px] text-[28px] italic leading-[1.4] text-[rgb(var(--v-ink)/0.85)]"
              style={{ fontFamily: 'var(--vision-font-serif)' }}
            >
              &ldquo;{brand.footer.newsletterHeadline}&rdquo;
            </p>
            <p className="mt-3 max-w-[340px] text-[13px] text-[rgb(var(--v-ink)/0.5)]">
              {brand.footer.newsletterSubtext}
            </p>
            <div className="mt-8 flex max-w-[340px] items-baseline justify-between border-b border-[rgb(var(--v-ink)/0.2)] pb-3.5">
              <span className="text-[13px] text-[rgb(var(--v-ink)/0.4)]" style={{ fontFamily: 'var(--vision-font-sans)' }}>
                {brand.footer.newsletterPlaceholder}
              </span>
              <span
                data-vision-magnet
                className="cursor-pointer text-[11px] uppercase text-[rgb(var(--v-gold))]"
                style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
              >
                {brand.footer.newsletterCta} →
              </span>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div
                className="mb-6 text-[10px] uppercase text-[rgb(var(--v-ink)/0.4)]"
                style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.4em' }}
              >
                {col.title}
              </div>
              <div className="flex flex-col gap-3.5 text-[13px] text-[rgb(var(--v-ink)/0.75)]" style={{ fontFamily: 'var(--vision-font-sans)' }}>
                {col.links.map((link) => (
                  <Link key={link.href} href={link.href} className="hover:text-[rgb(var(--v-gold))]">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          className="mt-20 flex flex-col gap-2 border-t border-[rgb(var(--v-ink)/0.08)] pt-8 text-[11px] uppercase text-[rgb(var(--v-ink)/0.4)] sm:flex-row sm:justify-between"
          style={{ fontFamily: 'var(--vision-font-sans)', letterSpacing: '.24em' }}
        >
          <div>© {new Date().getFullYear()} {brand.name} · All rights reserved</div>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-[rgb(var(--v-gold))]">Privacy Policy</Link>
            <Link href="/sitemap.xml" className="hover:text-[rgb(var(--v-gold))]">Sitemap</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
