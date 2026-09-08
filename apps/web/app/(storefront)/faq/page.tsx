import type { Metadata } from 'next';
import { PageHeader } from '@/components/common/page-header';
import { brand } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'FAQ',
  description: `Answers to common questions about ordering, shipping and returns at ${brand.name}.`,
};

/**
 * RESOLVED 2026-09-03 (design/ui-redesign) — see git history for the prior
 * audit comment this replaces. Of the six original entries, four made false
 * or unverifiable claims and are removed rather than rewritten (COD, delivery
 * timing, tarnish-proof, customisation — the real answers are the client's to
 * give, not ours to invent, same discipline as lib/brand.ts's pending-copy
 * notes). The two kept below are accurate as of this date:
 *
 *   - Returns: backed by `returns.window_days` (FEAT-SETTINGS-STORE),
 *     currently 10 — see lib/storefront-claims.ts if that setting changes.
 *   - Tracking: trimmed to the order-status timeline that actually exists;
 *     the original wording overclaimed live shipment tracking, which does
 *     not exist because shipping itself is unbuilt (FR-10).
 *
 * Re-add the removed entries only once the client has given real answers —
 * do not restore this file's previous copy from history and ship it as-is.
 */
const faqs = [
  {
    q: 'Can I return or exchange a piece?',
    a: 'Unworn pieces in original packaging can be returned within 10 days of delivery. Start a return from your order history — see our Shipping & Returns page for the full policy.',
  },
  {
    q: 'How do I track my order?',
    a: 'Log in and visit your profile to see the status of every order.',
  },
];

export default function FaqPage() {
  return (
    <div>
      <PageHeader title="Frequently Asked Questions" subtitle="Everything you need to know before you shop." />
      <div className="mx-auto max-w-2xl px-6 py-12 lg:px-8">
        {/*
          A plain list, not a <dl>. A definition list may contain only
          dt/dd/div, so wrapping <details> in one is invalid markup — axe flags
          it as a serious `definition-list` violation, and a screen reader
          announcing "definition list, 0 items" is worse than no semantics at
          all. Found by e2e/accessibility.spec.ts on its first run
          (STD-ACCESSIBILITY rule 2).
        */}
        <ul className="space-y-3">
          {faqs.map((item) => (
            <li key={item.q}>
              <details className="group rounded-sm border border-border-warm p-4">
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
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
