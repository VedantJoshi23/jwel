import type { Metadata } from 'next';
import { PageHeader } from '@/components/common/page-header';
import { brand } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: `Get in touch with the ${brand.name} customer care team.`,
};

const channels = [
  { label: 'Email', value: 'care@glint.example', href: 'mailto:care@glint.example' },
  { label: 'Phone', value: '+91 98765 43210', href: 'tel:+919876543210' },
  { label: 'Support hours', value: 'Mon–Sat, 10am–7pm IST' },
];

export default function ContactPage() {
  return (
    <div>
      <PageHeader title="Contact Us" subtitle="We usually reply within one business day." />
      <div className="mx-auto max-w-2xl px-6 py-12 lg:px-8">
        <dl className="grid gap-6 sm:grid-cols-3">
          {channels.map((c) => (
            <div key={c.label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{c.label}</dt>
              <dd className="mt-1.5 text-sm text-ink-primary">
                {c.href ? (
                  <a href={c.href} className="underline">
                    {c.value}
                  </a>
                ) : (
                  c.value
                )}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-10 text-sm leading-relaxed text-ink-secondary">
          For order-specific questions, include your order number so we can help faster. For returns and
          exchanges, see our{' '}
          <a href="/shipping" className="underline">
            Shipping &amp; Returns
          </a>{' '}
          page first — it covers most common cases.
        </p>
      </div>
    </div>
  );
}
