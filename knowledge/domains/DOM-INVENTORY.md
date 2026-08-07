---
id: DOM-INVENTORY
title: 'Jwel / ELYSIAN — Domain: Inventory'
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
  - ADR-0014
tags:
  - domain
  - inventory
risk: High
complexity: Low
---

# DOM-INVENTORY

**Depth tier: Full** — small surface, but it owns the invariant that stops the
business overselling.

## 1. Overview

Inventory owns stock arithmetic: how many units of a variant exist, how many
are reserved by in-flight checkouts, and how many are therefore available. It is
the smallest Full domain in the system and carries the single best-engineered
rule in it.

## 2. Ownership

**Owns** — `Inventory` (one row per variant), the reserve / release / commit
operations, and the low-stock threshold.

**Explicitly does NOT own** — product identity (Catalog); what an order
contains (Ordering); when stock should be restored (Returns decides, Inventory
executes); purchasing or restocking, which happen outside the system entirely
(`ARCH-001` §1.4).

## 3. Invariants

| # | Invariant | Source |
| --- | --- | --- |
| 1 | Reserve, release and commit are **conditional `UPDATE`s carrying the invariant in the `WHERE` clause**. Never read-then-write. | KC-183, `STD-DATABASE` r5 |
| 2 | `quantity_on_hand >= 0` and `quantity_reserved >= 0`, enforced by the `non_negative_stock` CHECK constraint. | KC-134 |
| 3 | `quantity_reserved <= quantity_on_hand`, enforced by the `reserved_not_exceeding_on_hand` CHECK constraint. | KC-134 |
| 4 | A reservation that cannot be satisfied **fails**; it never partially reserves. | KC-183 |
| 5 | Release clamps at zero — releasing more than reserved cannot produce a negative. | KC-183 |
| 6 | An adjustment may not reduce on-hand below what is already reserved. | KC-183 |
| 7 | Exactly one `Inventory` row per `ProductVariant`. | schema |
| 8 | Only Ordering and Returns command this domain. Shopping reads availability but never reserves — **a cart confers no claim on stock**. | `DOM-SHOPPING` inv. 10 |

**Invariant 1 is the reference pattern for the whole codebase.** `DISC-008`
rated it the best piece of engineering found in Discovery: putting the
invariant in the predicate makes an oversell *impossible* under concurrency
rather than improbable, because there is no read-then-write window to lose.

## 4. API Surface

**Admin only** — `GET /admin/inventory/low-stock`,
`GET /admin/inventory/:variantId`, `PATCH /admin/inventory/:variantId/adjust`.

No customer-facing endpoint. Availability reaches customers through Catalog's
product responses.

## 5. Events

**Publishes** — none. **Consumes** — none.

Inventory is command-driven only. This is deliberate: stock changes are
synchronous and transactional, and an at-most-once bus (`ARCH-001` §3.1) is the
wrong carrier for them.

## 6. Data Ownership

`inventory_items` — unique on `variant_id`; indexed
`(quantity_on_hand, quantity_reserved)` for the low-stock dashboard.

**Note:** the index comment describes a partial index; Prisma cannot express
one, so it is a plain composite index (KC-145). Comment and implementation
disagree — a documentation fix, not a behavioural one.

## 7. Dependencies

**Allowed** — Catalog (read, for variant existence); audit log.

**Forbidden** — writing any Catalog, Ordering, Returns or Payments table;
emitting events; reading Shopping, Reviews or Recommendation.

## 8. Edge Cases & Validations

1. **Two checkouts for the last unit.** One succeeds, one gets a conflict
   (Invariant 1). This is the case the pattern exists for.
2. **Release without a matching reserve.** Clamped at zero (Invariant 5).
3. **Admin reduces on-hand below reserved.** Rejected (Invariant 6).
4. **Reservation never released** because payment never completed.
   **Resolved** by `DOM-ORDERING` Invariant 11 — a periodic sweep cancels the
   stale order and commands release. Inventory itself gains no timer; it stays
   command-driven, which keeps the release path identical to every other one.
5. **Variant deleted with stock reserved.** Cascade behaviour must not orphan
   reservations mid-checkout.
6. **Every SKU reads zero.** Current state: 1,047 variants at zero on-hand
   against a threshold of 5 (KC-031), so the low-stock dashboard reports
   everything. Not a defect — placeholder catalog awaiting client data
   (KC-049).

## Constitution compliance

Law 1 — §8.6 explains the meaningless low-stock signal rather than presenting
the dashboard as informative. Law 2 — sourced. Law 4 — Invariants 1–3 and 6 are
database-enforced; this domain is the Law's best example. Law 5 — command-only,
no cross-context writes.

## Open items

- The release sweep is **Ordering's** to build (`DOM-ORDERING` inv. 11);
  Inventory needs no change.
- The partial-index comment (KC-145) should be corrected.
