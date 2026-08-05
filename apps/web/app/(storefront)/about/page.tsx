import type { Metadata } from 'next';
import { PageHeader } from '@/components/common/page-header';
import { brand } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'About Us',
  description: `The story behind ${brand.name} — handcrafted jewellery for festive glamour and everyday elegance.`,
};

export default function AboutPage() {
  return (
    <div>
      <PageHeader title="Our Story" subtitle={brand.tagline} />
      <div className="mx-auto max-w-3xl px-6 py-12 lg:px-8">
        <p className="text-ink-secondary leading-relaxed">{brand.story.intro}</p>
        <p className="mt-5 text-ink-secondary leading-relaxed">
          Every collection is produced in small batches, checked piece by piece, and priced without the
          heavy markup of traditional jewellery retail — so the craft stays intact without the ceremony.
        </p>

        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {brand.story.values.map((v) => (
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
