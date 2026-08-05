import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/common/page-header';
import { brand } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Shipping & Returns',
  description: `Delivery timelines and return policy for ${brand.name} orders.`,
};

export default function ShippingPage() {
  return (
    <div>
      <PageHeader title="Shipping & Returns" subtitle="Delivery timelines, return windows and how to start one." />
      <div className="mx-auto max-w-2xl space-y-8 px-6 py-12 lg:px-8">
        <section>
          <h2 className="font-display text-xl font-bold">Shipping</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-secondary">
            <li>Free standard delivery on all orders above ₹999; a flat fee applies below that.</li>
            <li>Orders are dispatched within 24 hours and arrive in 3–6 business days.</li>
            <li>You&rsquo;ll receive a confirmation and status updates on your account once the order ships.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold">Returns & Exchanges</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-secondary">
            <li>Returns are accepted within 7 days of delivery for unworn pieces in original packaging.</li>
            <li>Earrings and customised pieces are final sale for hygiene and production reasons.</li>
            <li>Refunds are issued to the original payment method within 5–7 business days of the return being received.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold">Starting a return</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
            Log in and open{' '}
            <Link href="/profile" className="underline">
              your profile
            </Link>{' '}
            to find the order you&rsquo;d like to return and follow the prompts. Reach out via{' '}
            <Link href="/contact" className="underline">
              Contact us
            </Link>{' '}
            if you run into any trouble.
          </p>
        </section>
      </div>
    </div>
  );
}
