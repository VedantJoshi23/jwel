/**
 * Every customer-facing claim this storefront makes that the system does not
 * (yet) back — Constitution **Law 1**: *a surface may not assert a capability
 * the system does not have.*
 *
 * `DISC-008` consolidated ten such claims across the storefront. They were
 * recorded in `deploy/RUNBOOK.md` step 0 as a prose table, and a prose table
 * has one failure mode: it goes stale silently. It was already stale — dated
 * 2026-08-06, listing a claim twice, and still describing the return window as
 * unenforced after it had been built.
 *
 * This file is that table, made checkable. `storefront-claims.test.ts` reads
 * the real source files and enforces both directions:
 *
 * - an **outstanding** claim whose text has disappeared means someone fixed
 *   the copy without updating this registry → the test fails, asking for the
 *   entry to be resolved;
 * - a **resolved** claim whose text has reappeared means it came back → the
 *   test fails.
 *
 * So the registry cannot drift from the copy in either direction, and
 * `pnpm claims:audit --strict` turns it into the launch gate the RUNBOOK step
 * always meant to be.
 *
 * **The demo banner is what makes the outstanding entries tolerable.** It tells
 * customers nothing here is real. The change that removes it must empty this
 * list first — that ordering is the whole point of the gate.
 */

export type ClaimStatus = 'outstanding' | 'resolved';

export interface StorefrontClaim {
  id: string;
  /** What the customer is told. */
  claim: string;
  /** Repo-relative source files carrying it, checked by the test. */
  where: string[];
  /**
   * Text that must be present while `outstanding`, and absent once `resolved`.
   * Deliberately a distinctive fragment of the real copy rather than a loose
   * keyword — a pattern that matches half the site proves nothing.
   */
  pattern: RegExp;
  status: ClaimStatus;
  /** What the system actually does. */
  reality: string;
  /** What has to happen, and by whom. */
  resolution: string;
}

export const STOREFRONT_CLAIMS: StorefrontClaim[] = [
  {
    id: 'cod-available',
    claim: 'Cash on Delivery available under ₹10,000',
    where: ['app/(storefront)/faq/page.tsx'],
    pattern: /COD is available on most pincodes/,
    status: 'outstanding',
    reality: 'The client ruled COD out (KC-109). PaymentProvider is RAZORPAY only.',
    resolution: 'Delete the answer. No capability is coming — this one cannot be fixed by building.',
  },
  {
    id: 'dispatch-24h',
    claim: 'Dispatched within 24 hours',
    where: [
      'app/(storefront)/faq/page.tsx',
      'app/(storefront)/shipping/page.tsx',
      'lib/brand.ts',
    ],
    pattern: /within 24 hours/,
    status: 'outstanding',
    reality: 'No dispatch SLA exists anywhere in code (KC-013), and shipping is unbuilt (FEAT-SHIPPING).',
    resolution: 'Client decides the real commitment, or the copy stops making one.',
  },
  {
    id: 'delivery-window',
    claim: 'Arrives in 3–6 business days',
    where: ['app/(storefront)/faq/page.tsx', 'app/(storefront)/shipping/page.tsx'],
    pattern: /3–6 business days/,
    status: 'outstanding',
    reality: 'Shiprocket is not integrated — the client account is blocked (KC-101). Nothing measures this.',
    resolution: 'Blocked on FEAT-SHIPPING; until then the copy is a guess.',
  },
  {
    id: 'returns-window',
    claim: 'Returns accepted within 10 days of delivery',
    where: ['app/(storefront)/faq/page.tsx', 'app/(storefront)/shipping/page.tsx'],
    pattern: /within 10 days of delivery/,
    status: 'resolved',
    reality:
      'Backed as of FEAT-SETTINGS-STORE: `returns.window_days` defaults to 10 and is enforced ' +
      'at request time, measured from the DELIVERED status entry.',
    resolution:
      'Done — the copy said 7 days and no window was enforced at all. **Coupled**: an admin ' +
      'changing `returns.window_days` makes this copy wrong again, because static copy cannot ' +
      'read a runtime setting. Flagged at the setting in the registry.',
  },
  {
    id: 'returns-condition',
    claim: 'Unworn pieces in original packaging',
    where: ['app/(storefront)/faq/page.tsx', 'app/(storefront)/shipping/page.tsx'],
    pattern: /original packaging/,
    status: 'outstanding',
    reality:
      'No rule validates condition. A return is accepted on request and judged by a human at ' +
      'the APPROVED step — which is a policy, not an enforced one.',
    resolution:
      'Arguably fine as stated intent rather than a system claim, but it needs the client to ' +
      'confirm they will actually refuse a worn piece.',
  },
  {
    id: 'self-serve-returns',
    claim: 'Start a return from your order history',
    where: ['app/(storefront)/faq/page.tsx'],
    pattern: /Start a return from your order history/,
    status: 'resolved',
    reality:
      'True as of FEAT-CUSTOMER-RETURNS. Every delivered order in the Orders tab carries a ' +
      '"Request a return" control per item, and a Returns tab shows each request\'s status.',
    resolution:
      'Done — the claim was written before the UI existed and the API had been reachable only ' +
      'by an administrator. Note what is still true and deliberate: there is no *cancel* ' +
      'control, because DOM-RETURNS Invariant 6 forbids withdrawing a request. If the FAQ is ' +
      'ever rewritten to promise cancellation, that becomes a new claim.',
  },
  {
    id: 'customisation',
    claim: 'Customisation available on select styles',
    where: ['app/(storefront)/faq/page.tsx'],
    pattern: /can be customised for size or stone colour/,
    status: 'outstanding',
    reality: 'No customisation capability exists. The fallback is an unstaffed promise to "confirm feasibility".',
    resolution: 'Delete, or the client commits to handling these by hand and staffs the Contact page.',
  },
  {
    id: 'tarnish-resistant',
    claim: 'Tarnish-resistant plating',
    where: ['app/(storefront)/faq/page.tsx'],
    pattern: /tarnish-resistant plating/,
    status: 'outstanding',
    reality: 'A product claim, not a system claim — nothing here can verify it.',
    resolution: 'The client stands behind it or it goes. The only entry the software cannot settle.',
  },
  {
    id: 'live-tracking',
    claim: 'Live status for every order, through to delivery',
    where: ['app/(storefront)/faq/page.tsx'],
    pattern: /live status for every order/i,
    status: 'outstanding',
    reality:
      'An order status timeline exists and is real. Live *shipment* tracking does not, because ' +
      'shipping is unbuilt — so "live" overstates what a customer will see.',
    resolution: 'Reword to describe the status timeline, which is honest and already works.',
  },
  {
    id: 'free-shipping-999',
    claim: 'Free shipping on orders above ₹999',
    where: ['lib/brand.ts'],
    pattern: /Free shipping on orders above ₹999/,
    status: 'outstanding',
    reality:
      'No shipping-fee rule exists at all (KC-012). Three different variants of this promise ' +
      'appear across the sale bar, PDP and checkout.',
    resolution:
      'Client sets one threshold; it becomes a setting (FEAT-SETTINGS-STORE) that checkout ' +
      'actually applies. Until then every variant is unbacked.',
  },
  {
    id: 'subscription',
    claim: 'Monthly "Jewel Box" subscription',
    where: ['lib/brand.ts', 'app/(storefront)/page.tsx'],
    pattern: /Jewel Box/,
    status: 'outstanding',
    reality: 'No model, no module. Deferred pending client feedback (KC-106).',
    resolution: 'Remove the section and footer link, or build it. It is a whole product, not copy.',
  },
  {
    id: 'whatsapp-contact',
    claim: '"WhatsApp us" in the footer',
    where: ['lib/brand.ts'],
    pattern: /WhatsApp us/,
    status: 'resolved',
    reality:
      'True as of 2026-08-08: the client supplied a WhatsApp number and the link is a real ' +
      'wa.me click-to-chat. It used to point at `#` and not even navigate.',
    resolution:
      'Done — but note what it does **not** cover. This is a *contact* channel: a customer ' +
      'starts the conversation. Automated WhatsApp *notifications* need Business API ' +
      'credentials from Meta or a provider, which a phone number is not, so ' +
      'FEAT-WHATSAPP-SMS-NOTIFICATIONS stays blocked. If the footer or FAQ ever promises ' +
      'order updates by WhatsApp, that is a new claim.',
  },
];

export const outstandingClaims = (): StorefrontClaim[] =>
  STOREFRONT_CLAIMS.filter((c) => c.status === 'outstanding');
