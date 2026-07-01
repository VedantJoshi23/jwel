import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/page-header';
import { brand } from '@/lib/brand';

export const metadata: Metadata = {
  title: brand.subscription.headline,
  description: brand.subscription.subtext,
};

export default function SubscriptionsPage() {
  return (
    <div>
      <PageHeader title={brand.subscription.headline} subtitle={brand.subscription.subtext} />
      <div className="mx-auto max-w-2xl px-6 py-12 text-center lg:px-8">
        <div className="grid gap-8 sm:grid-cols-3">
          {brand.subscription.steps.map((step, i) => (
            <div key={step}>
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary font-display text-sm font-bold text-white">
                {i + 1}
              </div>
              <p className="mt-3 text-sm font-medium">{step}</p>
            </div>
          ))}
        </div>

        <Button asChild size="l" className="mt-10">
          <Link href="/register">{brand.subscription.cta}</Link>
        </Button>

        <p className="mt-5 text-sm text-ink-secondary">
          Already a subscriber and need to skip, pause or cancel? Reach out via{' '}
          <Link href="/contact" className="underline">
            Contact us
          </Link>{' '}
          and we&rsquo;ll sort it out.
        </p>
      </div>
    </div>
  );
}
