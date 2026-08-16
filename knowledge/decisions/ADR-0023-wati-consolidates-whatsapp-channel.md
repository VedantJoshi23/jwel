---
id: ADR-0023
title: Wati Consolidates the WhatsApp Channel — Notifications and Ordering, One Integration
version: 0.1.0
status: Accepted
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-16
updated: 2026-08-16
milestone: M6
category: Decisions
priority: High
depends_on:
  - ADR-0022
required_by:
  - DOM-NOTIFICATION
related_documents: []
related_decisions:
  - ADR-0003
  - ADR-0022
tags:
  - decision
  - whatsapp
  - notification
  - vendor
risk: Medium
complexity: Low
---

# ADR-0023 — Wati Consolidates the WhatsApp Channel

## Context

`ADR-0022` adopted Wati for WhatsApp ordering and, in its Consequences,
flagged an unresolved question rather than deciding it silently: a WhatsApp
Business number's API access is managed by one technology/solution provider
at a time in practice, so `ADR-0003`'s plan — a *direct* Meta Cloud API
integration for transactional notifications, on the same number Wati now
also needs for ordering — was put in doubt without being resolved.

Two paths were compared for the client:

- **Consolidate.** Route notifications (order confirmation, shipment
  updates, refund confirmation) through Wati's own send-message API instead
  of Meta's Cloud API directly. One number, one integration, one vendor
  relationship for the customer.
- **Split.** Keep `ADR-0003`'s direct integration for notifications, put
  ordering on a second, separate WhatsApp number via Wati. Technically
  cleaner in isolation, but the customer would see two different WhatsApp
  contacts for one business, and it removes none of the vendor dependency
  `ADR-0022` already accepted — it only adds a second one running alongside
  it.

Consolidation was checked against Wati's own API documentation before being
recommended, not assumed: Wati publishes a general-purpose template-send
endpoint (`POST /api/v1/sendTemplateMessage`), not only commerce/cart-flow
messaging, so routing utility-category notifications through Wati is a real,
documented capability — not a workaround.

## Decision

**Consolidate.** All outbound WhatsApp messaging — the ordering conversation
(`ADR-0022`) and the transactional notifications `ADR-0003` scoped
(order confirmation, shipment tracking, refund confirmation) — routes
through Wati, on one business number. `ADR-0003`'s direct-Meta-Cloud-API
plan is **superseded**, not merely revised: no part of it is still the plan,
per Constitution Law 2 the reasoning stays readable in that document rather
than being deleted.

`NotificationsService`'s WhatsApp channel (`DOM-NOTIFICATION` §2, §7) will
call Wati's template-send API in place of a direct Meta Cloud API adapter.
This is a smaller build than `ADR-0003` originally scoped, not a larger one —
`FEAT-WHATSAPP-SMS-NOTIFICATIONS` was going to build a direct integration
from nothing; it now calls a vendor already being integrated for a larger
reason.

## Consequences

1. **`DOM-NOTIFICATION` and `FEAT-WHATSAPP-SMS-NOTIFICATIONS` need updating**
   before that feature is built — both currently describe a direct Meta
   Cloud API adapter. Tracked as the first item this ADR's roadmap
   cross-reference resolves.
2. **Cost is not yet fully known, and one category looks materially worse
   than the rest.** Wati's own pricing page and help-center documentation
   do not disclose, in either direction, whether template messages sent
   outside the commerce/cart flow are billed at Meta's raw per-message rate
   or at a marked-up rate on Wati's own rate card. Multiple independent
   third-party WhatsApp-API comparison sources (not Wati's own materials,
   but several agreeing independently) converge on: **utility ~19%
   markup, marketing ~20% markup, authentication ~257% markup** over Meta's
   own per-message rate. If accurate, an authentication-category message
   (the category an OTP falls under) costs roughly 3.5× Meta's raw rate
   through Wati — not a rounding difference. This matters concretely for
   Phase 2 of the roadmap's phone-verification step: **if that OTP is sent
   over WhatsApp via Wati, it lands in the expensive category**; sending it
   over SMS (MSG91, unaffected by this ADR) instead sidesteps the question
   entirely and is worth treating as the default rather than a fallback.
   None of this is confirmed against Wati's own rate card — per
   Constitution Law 1, stated as a strong signal from convergent secondary
   sources, not a settled number, and flagged in the roadmap as needing
   direct confirmation before final budget sign-off.
3. **One vendor, one relationship, one webhook endpoint** for all WhatsApp
   traffic — removes the "two systems on one number" risk `ADR-0022`
   flagged, at the cost of `ADR-0003`'s original "no BSP markup" reasoning
   no longer applying to any part of the WhatsApp channel.
4. **`ADR-0022`'s Consequence 1 is now resolved** by this ADR; that document
   is annotated to point here rather than left saying "not yet decided."

## Alternatives Considered

- **Split across two numbers** — see Context. Rejected: confuses the
  customer-facing identity of the business ("which WhatsApp is really
  jwel/ELYSIAN") for no reduction in vendor dependency, which was the
  concern splitting was meant to address.
- **Leave `ADR-0003` as-is and revisit only if it breaks in practice** —
  rejected per Constitution Law 3: a recorded commitment changes by explicit
  navigation, not by waiting for it to fail silently once Wati is live on
  the number.

## Revisit Criteria

- Wati's rate card, once confirmed, makes notification volume meaningfully
  more expensive than a direct Meta integration would have been — named
  trigger, checked against Consequence 2 once real numbers exist.
- Wati's template-send API turns out not to support one of the three
  existing notification types cleanly (unlikely per the documented
  capability checked in Context, but not exercised against a real send yet).

## Cross References

- `ADR-0003` — superseded by this decision; annotated in place per Law 2.
- `ADR-0022` — the decision that put this question on the table; annotated
  to point here.
- `DOM-NOTIFICATION` — WhatsApp channel description needs updating to target
  Wati, not Meta Cloud API directly.
- `docs/milestones/roadmap-whatsapp-ordering.md` — Phase 0's first item,
  resolved by this ADR.
