---
id: DOM-PRICING
title: 'Jwel / ELYSIAN — Domain: Pricing & Promotion'
version: 1.0.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M5
category: Domains
priority: High
depends_on:
  - ARCH-001
  - CONSTITUTION
required_by: []
related_documents:
  - DISC-005
  - DISC-008
related_decisions:
  - ADR-0014
tags:
  - domain
  - pricing
risk: Medium
complexity: Medium
---

# DOM-PRICING

**Depth tier: Full** — owns discount rules and the eligibility logic behind
them.

## 1. Overview

Pricing & Promotion owns coupons: what they are worth, when they apply, who may
use them and how often. It calculates a discount; it never applies one to an
order — Ordering does that with the number this domain returns.

## 2. Ownership

**Owns** — `Coupon`, `CouponRedemption`, discount calculation, and eligibility
rules including first-order determination.

**Explicitly does NOT own** — order totals (Ordering); product prices
(Catalog); payment amounts (Payments); the sale-bar copy advertising discounts,
which lives in `brand.ts`.

## 3. Invariants

| # | Invariant | Source |
| --- | --- | --- |
| 1 | A coupon validates against six checks in order: exists and is active and not soft-deleted; now within `validFrom`–`validTo`; subtotal meets `minOrderAmount`; global redemptions below `maxRedemptions`; this user's redemptions below `maxRedemptionsPerUser`; and for `FIRST_ORDER`, zero prior orders. | KC-181 |
| 2 | Redemption limits are enforced by `COUNT()` over an **append-only** `CouponRedemption` ledger, never a mutable counter. | KC-133 |
| 3 | `FIRST_ORDER` eligibility counts **every** order the user has placed, regardless of status. A cancelled first order does not restore eligibility. | KC-182, KC-189 |
| 4 | `valid_to > valid_from`, enforced by the `valid_date_range` CHECK constraint. | KC-134 |
| 5 | `Coupon.value` is type-dependent: 0–100 for `PERCENTAGE`, minor units for `FLAT`/`FIRST_ORDER`. **Enforced in the application layer only** — the database cannot express it. | KC-143 |
| 6 | Redemption is recorded in the same transaction as the order it applies to. | KC-181, `DOM-ORDERING` |

**Invariant 3 is deliberate anti-abuse** (KC-189): place, cancel, repeat would
otherwise farm the first-order discount indefinitely. It is invisible to the
customer who triggers it, which is why it must appear in whatever coupon terms
the client publishes.

**Invariant 5 is the domain's sharpest risk.** A `PERCENTAGE` coupon with value
`5000` means 5000% — and the database will accept it. `DISC-007` carried a
proposal to split the column so each type can be constrained; it remains open.

## 4. API Surface

**Customer** — `POST /coupons/validate`
**Admin** — `GET /admin/coupons`, `POST /admin/coupons`,
`PATCH /admin/coupons/:id/deactivate`

## 5. Events

**Publishes** — none. **Consumes** — none.

## 6. Data Ownership

`coupons` (unique code; indexed `(isActive, validFrom, validTo)`),
`coupon_redemptions` (unique `order_id`; indexed `(couponId, userId)`).

**Reads, does not own:** `orders`, to count a user's prior orders for
Invariant 3. A permitted cross-context **read** under `STD-API`'s exception
clause (KC-157) — the alternative, Ordering exposing an is-first-order query,
was judged worse coupling in a different direction.

## 7. Dependencies

**Allowed** — Ordering (read only, for prior-order count); audit log.

**Forbidden** — writing `orders` or any Ordering table; reading Catalog,
Payments, Returns or Shopping; emitting events.

## 8. Edge Cases & Validations

1. **Two concurrent checkouts using the last redemption of a capped coupon.**
   `COUNT()` over the ledger is evaluated inside the order transaction, so one
   succeeds. Invariant 2 exists for this case.
2. **Coupon expires between validation and checkout.** Re-validated at order
   creation; the earlier validation is advisory.
3. **`PERCENTAGE` coupon with value > 100.** Accepted by the database
   (Invariant 5). Application-layer validation is the only guard.
4. **First-order coupon for a user whose only order was cancelled.** Refused
   (Invariant 3). Correct, and invisible to the customer — a support question
   waiting to happen unless the terms say so.
5. **Discount exceeding the order subtotal.** Must clamp; a negative total is
   not a valid order.
6. **Soft-deleted coupon with historical redemptions.** Redemptions remain,
   referential integrity holds.

## Constitution compliance

Law 1 — Invariant 5's limitation is stated rather than implied enforced.
Law 2 — sourced. Law 4 — Invariant 4 is a CHECK constraint; Invariant 5 is the
documented exception, per `STD-DATABASE` r6. Law 5 — read-only across the
Ordering boundary, never a write.

## Open items

- **Splitting `Coupon.value`** so each discount type can be database-constrained
  (`DISC-007` Q6). Open; a small correctness win with no urgency.
- **Invariant 3 needs to appear in published coupon terms**, or customers hit it
  with no explanation.
