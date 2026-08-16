---
id: ADR-0022
title: Wati as the WhatsApp Commerce (Ordering) Platform
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
  - ADR-0011
required_by: []
related_documents: []
related_decisions:
  - ADR-0003
  - ADR-0005
  - ADR-0011
tags:
  - decision
  - whatsapp
  - commerce
  - vendor
risk: Medium
complexity: Medium
---

# ADR-0022 — Wati as the WhatsApp Commerce (Ordering) Platform

## Context

The client asked for end-to-end ordering over WhatsApp: a customer browses the
catalogue, builds a cart, pays by QR/payment link, and receives a delivery
estimate, entirely inside a WhatsApp conversation, sharing the same cart and
order records as the website rather than a parallel system.

Per `ADR-0011`'s Hybrid mode, this was scoped as a comparison rather than a
unilateral pick: build the conversation engine directly on Meta's raw
WhatsApp Cloud API (full control, larger build, no platform subscription), or
adopt a packaged WhatsApp commerce platform that already ships catalogue, cart
and checkout-bot tooling (smaller build, faster launch, adds a vendor
subscription). Both paths, their trade-offs, and a sourced cost range for
each were presented to the client for a decision.

**The client decided.** They want the pre-built path, not a from-scratch
conversation engine, and named **Wati** as the specific platform — a named
choice, not one this document re-derives from a feature comparison the way
`ADR-0001`/`ADR-0003` did for their respective vendor picks. Wati was not one
of the two platforms compared by name in the scoping estimate (Interakt and
AiSensy were); the client's selection is recorded here as given.

## Decision

**Wati** is the WhatsApp Business Platform layer for the ordering vertical —
catalogue delivery, cart-in-chat, checkout, payment-link/QR collection, and
order-status messaging over WhatsApp all route through Wati, integrated with
jwel's own `Cart`, `Order` and `Payment` records via Wati's API/webhooks
rather than a bespoke conversation engine talking to Meta's Cloud API
directly.

Per `STD-API` rule 7 (ports confined to vendor boundaries), Wati is
integrated behind an adapter — the same posture already used for Storage
(`filesystem`/`s3`) and Payments (`RazorpayProvider`/`MockPaymentProvider`) —
so a future platform swap (`ADR-0011`'s "swapping a layer reopens its ADR")
does not require touching the order/cart logic that calls it.

## Consequences

1. **This narrowed `ADR-0003`'s "direct Meta Cloud API, no BSP" posture —
   resolved by `ADR-0023`.** `ADR-0003` picked direct integration for
   one-way transactional notifications specifically; it did not anticipate
   a second, larger WhatsApp integration arriving for ordering, and a
   WhatsApp Business number's API access being managed by one
   provider at a time meant the two plans likely couldn't coexist. Rather
   than leave that as an open question, `ADR-0023` (2026-08-16) decided it:
   Wati carries all outbound WhatsApp messaging on the number, notifications
   included.
2. **New recurring cost — confirmed first-party (quarterly billing, wati.io
   pricing page, checked 2026-08-16)**:
   - **Growth** ₹2,699/month — 1 channel, 3 users included, no additional
     users available on this tier, messages billed separately on top.
   - **Pro** ("Best Value") ₹5,799/month — 5 users included, additional
     users ₹1,299/user/month.
   - **Business** ₹16,799/month — 5 users included, additional users
     ₹2,199/user/month.
   - A **Pay-as-you-go** option exists outside the subscription tiers: ₹999
     one-time, credited back as ₹999 of message credits (~500 messages),
     3-month account validity — a genuinely useful low-risk way to see
     Wati's real per-message deduction rate in the dashboard before
     committing to a subscription tier, see Consequence 3.
   - An additional WhatsApp number on any tier is ₹2,499/month/number.
   - Enterprise-volume discounts exist for >1M messages/month, quote-only.

   This is on top of Meta's own per-message rate, billed through Wati
   rather than direct, and Razorpay's existing 2% (unchanged — see
   Consequence 6).
3. **The per-message rate card itself is still not confirmed.** Wati's
   pricing page has a "Pay Per Message, Get More Control" section with what
   is evidently an interactive rate calculator — it renders blank even in a
   full print/PDF capture of the page, so neither this ADR nor the earlier
   research behind it has seen it directly. `ADR-0023` Consequence 2's
   third-party-reported markup figures (~19–20% on utility/marketing, ~257%
   on authentication) remain the only signal on this, unconfirmed against
   Wati's own numbers. The Pay-as-you-go plan above is the practical way to
   close this gap — its ₹999/~500-message deduction rate, checked in the
   dashboard after a few real sends, is Wati's actual rate, not a reported
   one.
4. **New engineering surface**, sized in the accompanying roadmap: catalogue
   feed to Wati, phone verification and account linking, and — the piece
   with no shortcut regardless of platform choice — reconciling a completed
   WhatsApp order into jwel's own `Order`/`Payment` tables so it is
   indistinguishable from a website order afterward.
5. **A new vendor dependency**, the same category of risk `ADR-0001`
   accepted for Shiprocket: ordering-via-WhatsApp now depends on Wati's
   uptime, API stability, and continued support for the catalogue/cart
   features this decision relies on.
6. **No change to `ADR-0005`.** Payment still settles through Razorpay;
   Wati carries a payment link or QR code, never card or bank data itself —
   `STD-SECURITY` rule 1 is unaffected, and this is additive to the existing
   `PaymentProviderPort`, not a second payment system.

## Alternatives Considered

Recorded for completeness, not because they remain open — the client's
choice closes this question:

- **Build the conversation engine directly on Meta's Cloud API** (no BSP).
  Full control, no platform subscription, but the whole cart/catalogue/
  checkout conversation becomes bespoke code instead of vendor
  configuration — the larger of the two builds sized in the scoping
  estimate. Rejected by client preference for the pre-built path.
- **Interakt or AiSensy** instead of Wati. Both were the two platforms
  actually compared by name in the scoping estimate that preceded this
  decision, both offer comparable catalogue/cart/checkout-bot tooling.
  Superseded by the client naming Wati specifically; not re-compared here.

## Revisit Criteria

- Wati's pricing or message/API limits prove insufficient at real order
  volume — named trigger, not a hypothetical to design around now.
- Wati is discontinued, or materially drops the commerce features this
  decision depends on.
- `ADR-0023`'s consolidation of the notification channel onto Wati proves
  costlier or less capable in practice than the direct-API plan it replaced
  — see that ADR's own Revisit Criteria.

## Cross References

- `ADR-0003` — the notification-channel decision this ADR put in question;
  resolved by `ADR-0023`.
- `ADR-0023` — resolved Consequence 1: Wati carries notifications too, not
  only ordering.
- `ADR-0005` — Razorpay remains the sole payment gateway; unaffected.
- `ADR-0011` — the Hybrid decision-mode process this choice followed:
  options compared and recommended, client decided.
- `STD-API` rule 7 — ports-and-adapters confinement, applied to the Wati
  integration the same way as Storage and Payments.
- The WhatsApp Ordering roadmap accompanying this ADR — sequences the work
  named in Consequences 1 and 3.
