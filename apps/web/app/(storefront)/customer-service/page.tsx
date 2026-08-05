import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/common/page-header';
import { brand } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Customer Service',
  description: `Support hours and quick links for ${brand.name} customers.`,
};

const links = [
  { title: 'FAQ', body: 'Answers to the questions we get asked most.', href: '/faq' },
  { title: 'Shipping & Returns', body: 'Delivery timelines and how to start a return.', href: '/shipping' },
  { title: 'Contact us', body: 'Reach the care team directly.', href: '/contact' },
  { title: 'Track an order', body: 'View live status from your profile.', href: '/profile' },
];

export default function CustomerServicePage() {
  return (
    <div>
      <PageHeader
        title="Customer Service"
        subtitle="Support is available Mon–Sat, 10am–7pm IST. Here's the fastest way to find an answer."
      />
      <div className="mx-auto max-w-3xl px-6 py-12 lg:px-8">
        <div className="grid gap-5 sm:grid-cols-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-s border border-border-warm p-5 transition-colors hover:border-brand-primary"
            >
              <h2 className="font-display text-lg font-bold">{l.title}</h2>
              <p className="mt-1.5 text-sm text-ink-secondary">{l.body}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
