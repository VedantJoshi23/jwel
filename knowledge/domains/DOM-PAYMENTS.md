---
id: DOM-PAYMENTS
title: 'Jwel / ELYSIAN — Domain: Payments'
version: 1.0.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M5
category: Domains
priority: Critical
depends_on:
  - ARCH-001
  - CONSTITUTION
required_by: []
related_documents:
  - DISC-005
  - DISC-008
related_decisions:
  - ADR-0005
  - ADR-0010
tags:
  - domain
  - payments
risk: High
complexity: Medium
---

# DOM-PAYMENTS

**Depth tier: Full** — owns money movement and an external vendor boundary.

## 1. Overview

Payments owns the record of money moving between a customer and the business,
and the integration with the payment gateway. It knows nothing about orders
beyond the id it is paying for, and never changes one.

## 2. Ownership

**Owns** — `Payment`, the payment lifecycle, the gateway integration behind
`PaymentProviderPort`, and webhook verification.

**Explicitly does NOT own** — order status (emits an event; Ordering reacts);
refund *policy* (Returns decides, Payments executes); what was bought; pricing.

## 3. Invariants

| # | Invariant | Source |
| --- | --- | --- |
| 1 | Exactly one `Payment` per `Order`, enforced by a unique constraint on `order_id`. | KC-132, schema |
| 2 | **No card or bank data is ever stored.** `providerRef` is an opaque gateway reference; PCI scope is delegated entirely to the gateway. | `ADR-0005`, `STD-SECURITY` r1 |
| 3 | Payments **never writes `orders`**. Success is communicated by emitting `payment.succeeded`. | KC-151, Law 5 |
| 4 | The gateway sits behind `PaymentProviderPort`; no gateway-specific type escapes the adapter. | KC-155, NFR-9 |
| 5 | Webhook payloads are **signature-verified** before being trusted. | `STD-SECURITY`, `ADR-0005` |
| 6 | Amounts are integer minor units and match the order total at initiation. | KC-131 |
| 7 | Payment is **single-payee**. No split, no settlement, no commission — those are outside every context. | KC-090, `ARCH-001` §1.4 |
| 8 | Outside production, a mock provider resolves instead of the live gateway. | KC-059 |

**Invariant 7 is the marketplace boundary made concrete.** The business takes
commission from contracted jewellers (KC-080), and none of that reaches this
domain: the platform charges the customer once, to one payee. Anyone
implementing split settlement here should read `ARCH-001` §1.4 first.

## 4. API Surface

`POST /payments/verify` — client-side handoff verification after the Razorpay
modal returns.
`POST /payments/webhook/razorpay` — gateway callback; subscribed to
`payment.captured` and `payment.failed`.

## 5. Events

**Publishes** — `payment.succeeded`, consumed by Ordering.
**Consumes** — none.

## 6. Data Ownership

`payments` — unique on `order_id` and on `provider_ref`; indexed
`(provider, status)`.

## 7. Dependencies

**Allowed** — the gateway, via `PaymentProviderPort`; metrics.

**Forbidden** — writing `orders`, `order_items`, `return_requests` or
`inventory_items`; reading Catalog, Shopping, Reviews or Recommendation;
emitting another context's events.

Payments is one of the most isolated contexts in the system, and should stay
that way.

## 8. Edge Cases & Validations

1. **Webhook arrives before the client-side verification.** Both paths lead to
   the same state; whichever arrives first wins and the second is idempotent.
2. **Webhook replayed.** `provider_ref` is unique, so a duplicate cannot create
   a second payment.
3. **Unsigned or wrongly-signed webhook.** Rejected before any state change
   (Invariant 5).
4. **Payment succeeds, `payment.succeeded` is lost.** **Resolved** by
   `DOM-ORDERING` Invariant 12: a sweep finds `SUCCEEDED` payments whose order
   is still `PLACED` and confirms them. The fix lives in Ordering because it is
   Ordering's state that is stale — Payments' own record was always correct,
   which is exactly why re-derivation works and durable events are unnecessary.
5. **Refund requested for more than was paid.** Must be rejected; Payments owns
   the amount, Returns owns the policy.
6. **Gateway unreachable at checkout.** Checkout fails cleanly; no order is
   left half-created.

## Constitution compliance

Law 1 — §8.4 records the reconciliation gap. Law 2 — invariants sourced.
Law 4 — Invariants 1 and 6 rest on constraints. Law 5 — Invariant 3.
Law 6 — not applicable.

## Open items

- ~~Edge case 4~~ — settled by `DOM-ORDERING` Invariant 12's sweep. Worth
  noting for `ADR-0010`: this was the strongest argument for event durability,
  and it is answered by re-derivation instead. That ADR's triggers remain
  unfired.
- **Whether Razorpay emits an abandoned/expired-order event is unverified**
  (`DOM-ORDERING` inv. 11). Check the provider's webhook catalogue; the sweep
  does not depend on the answer.
