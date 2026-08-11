import type { Metadata } from 'next';
import { PageHeader } from '@/components/common/page-header';
import { brand } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: `Get in touch with the ${brand.name} customer care team.`,
};

/**
 * The client's real contact details, from `brand.ts` rather than typed here.
 *
 * This page previously listed `care@glint.example` — another brand's name —
 * and `+91 98765 43210`, the standard dummy Indian number. A customer who
 * tried either got nothing, on the one page whose entire purpose is being
 * reachable. Worse than the tracked storefront claims, because those at least
 * only over-promise; this failed at the thing it existed to do.
 */
const channels = [
  { label: 'Email', value: brand.contact.email, href: `mailto:${brand.contact.email}` },
  {
    label: 'WhatsApp',
    value: brand.contact.whatsappDisplay,
    href: `https://wa.me/${brand.contact.whatsappE164}`,
  },
  { label: 'Support hours', value: brand.contact.hours },
];

export default function ContactPage() {
  return (
    <div>
      <PageHeader title="Contact Us" subtitle="We usually reply within one business day." />
      <div className="mx-auto max-w-2xl px-6 py-12 lg:px-8">
        <dl className="grid gap-6 sm:grid-cols-3">
          {channels.map((c) => (
            // `min-w-0`: grid items default to `min-width: auto`, which
            // refuses to shrink a cell below its content's intrinsic width.
            // An email address has no spaces for the browser to wrap at, so
            // without this the cell held its natural full-length width and
            // spilled text across the WhatsApp column next to it rather than
            // wrapping — an overlap, not a rendering glitch.
            <div key={c.label} className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{c.label}</dt>
              <dd className="mt-1.5 break-words text-sm text-ink-primary">
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
