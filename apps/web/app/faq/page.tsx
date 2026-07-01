import type { Metadata } from 'next';
import { PageHeader } from '@/components/common/page-header';
import { brand } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'FAQ',
  description: `Answers to common questions about ordering, shipping and returns at ${brand.name}.`,
};

const faqs = [
  {
    q: 'Do you offer Cash on Delivery?',
    a: 'Yes, COD is available on most pincodes for orders under ₹10,000. Prepaid orders are eligible for the extra ₹300 checkout discount.',
  },
  {
    q: 'How long does delivery take?',
    a: 'Most orders ship within 24 hours and arrive in 3–6 business days depending on your location. You can track progress from your profile once the order is confirmed.',
  },
  {
    q: 'Can I return or exchange a piece?',
    a: 'Unworn pieces in original packaging can be returned within 7 days of delivery. Start a return from your order history — see our Shipping & Returns page for the full policy.',
  },
  {
    q: 'Is your jewellery tarnish-proof?',
    a: 'Our gold-toned pieces use tarnish-resistant plating designed for daily wear. We recommend keeping pieces dry and storing them in the pouch provided when not in use.',
  },
  {
    q: 'Do you offer customisation?',
    a: 'Select necklace and ring styles can be customised for size or stone colour. Reach out through our Contact page before placing your order and we’ll confirm feasibility.',
  },
  {
    q: 'How do I track my order?',
    a: 'Log in and visit your profile to see live status for every order, from confirmation through to delivery.',
  },
];

export default function FaqPage() {
  return (
    <div>
      <PageHeader title="Frequently Asked Questions" subtitle="Everything you need to know before you shop." />
      <div className="mx-auto max-w-2xl px-6 py-12 lg:px-8">
        <dl className="space-y-3">
          {faqs.map((item) => (
            <details key={item.q} className="group rounded-s border border-border-warm p-4">
              <summary className="cursor-pointer list-none font-medium text-ink-primary marker:content-none">
                <span className="flex items-center justify-between gap-4">
                  {item.q}
                  <span className="text-ink-muted transition-transform group-open:rotate-180" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{item.a}</p>
            </details>
          ))}
        </dl>
      </div>
    </div>
  );
}
