import type { Metadata } from 'next';
import { PageHeader } from '@/components/common/page-header';
import { brand } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'FAQ',
  description: `Answers to common questions about ordering, shipping and returns at ${brand.name}.`,
};

/**
 * PLACEHOLDER CONTENT — NOT REVIEWED, MUST NOT GO LIVE AS-IS.
 *
 * Every answer below makes a factual commitment to a customer, and several are
 * currently false. Flagged rather than rewritten (same discipline as brand.ts's
 * pending-copy TODOs) because the real answers are the client's to give, not
 * ours to invent. Audited 2026-08-06 against the system — see
 * knowledge/discovery/DISC-003-feature-inventory.md:
 *
 *   1. COD          — FALSE. The client has confirmed COD will not be offered
 *                     (KC-109). PaymentProvider is RAZORPAY only; no
 *                     cash-on-delivery logic exists anywhere. Delete or rewrite.
 *   2. Delivery     — UNBACKED. "Ships within 24 hours", "3-6 business days".
 *                     Shipping is not implemented (Shiprocket blocked on the
 *                     client's account, KC-101); no dispatch SLA is enforced
 *                     anywhere in code (KC-013).
 *   3. Returns      — PARTLY BACKED. The returns flow exists, but the 7-day
 *                     window and "unworn, original packaging" conditions are
 *                     not validated by any rule in the system.
 *   4. Tarnish      — PRODUCT CLAIM. Not verifiable from the system; needs the
 *                     client to stand behind it.
 *   5. Customisation— FALSE. No customisation capability exists (FR-12/FR-13
 *                     are unbuilt), and the fallback is an unstaffed promise to
 *                     "confirm feasibility" via the Contact page.
 *   6. Tracking     — PARTLY TRUE. Order status timeline exists; live shipment
 *                     tracking does not, because shipping is unbuilt (FR-10).
 *
 * The demo-store banner is the only thing currently preventing customers from
 * relying on any of this. Whatever change removes that banner must resolve this
 * list first — see deploy/RUNBOOK.md "Going live: the checklist" step 0.
 */
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
