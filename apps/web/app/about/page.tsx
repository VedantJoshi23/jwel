import type { Metadata } from 'next';
import { PageHeader } from '@/components/common/page-header';
import { brand } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'About Us',
  description: `The story behind ${brand.name} — handcrafted jewellery for festive glamour and everyday elegance.`,
};

const values = [
  {
    title: 'Handcrafted',
    body: 'Every piece is shaped, set and finished by hand by artisans who have spent decades perfecting Kundan, meenakari and temple jewellery techniques.',
  },
  {
    title: 'Heritage-led',
    body: 'Our designs draw on centuries-old South Asian jewellery traditions, reworked for how people actually dress and layer today.',
  },
  {
    title: 'Built to last',
    body: 'Tarnish-resistant plating and considered construction mean these are pieces you reach for season after season, not just for one occasion.',
  },
];

export default function AboutPage() {
  return (
    <div>
      <PageHeader title="Our Story" subtitle={brand.tagline} />
      <div className="mx-auto max-w-3xl px-6 py-12 lg:px-8">
        <p className="text-ink-secondary leading-relaxed">
          {brand.name} started with a simple idea: festive jewellery shouldn&rsquo;t mean choosing between
          heirloom craftsmanship and something you&rsquo;d actually wear on a regular Tuesday. We work with
          artisan clusters who specialise in Kundan work, temple jhumkas, pearl sets and meenakari rings to
          bring that craftsmanship to pieces designed for everyday rotation, not just the back of a locker.
        </p>
        <p className="mt-5 text-ink-secondary leading-relaxed">
          Every collection is produced in small batches, checked piece by piece, and priced without the
          heavy markup of traditional jewellery retail — so the craft stays intact without the ceremony.
        </p>

        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {values.map((v) => (
            <div key={v.title}>
              <h2 className="font-display text-lg font-bold">{v.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{v.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
