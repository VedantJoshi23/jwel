---
id: DOM-REVIEWS
title: 'Jwel / ELYSIAN — Domain: Reviews'
version: 1.2.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-11
milestone: M5
category: Domains
priority: High
depends_on:
  - ARCH-001
  - CONSTITUTION
required_by:
  - FEAT-ADMIN-REVIEW-MODERATION
  - FEAT-PENDING-REVIEW-VISIBILITY
related_documents:
  - DISC-005
  - DISC-008
related_decisions:
  - ADR-0008
tags:
  - domain
  - reviews
risk: Medium
complexity: Medium
---

# DOM-REVIEWS

**Depth tier: Full** — owns review content and moderation.

## 1. Overview

Reviews owns what customers say about products and whether it is shown. It does
**not** own the rating number that appears on a product — Catalog does, and
Reviews asks it to recompute.

## 2. Ownership

**Owns** — `Review`, moderation state, and verified-purchase determination.

**Explicitly does NOT own** — `Product.avgRating` / `ratingCount` (Catalog owns
them per `ADR-0008`); product identity; search ranking, which consumes the
aggregate.

## 3. Invariants

| # | Invariant | Source |
| --- | --- | --- |
| 1 | **Anyone may review any product without having bought it.** Purchase is not a gate. | KC-184 |
| 2 | `verifiedPurchase` is a **computed badge** — true when the user has a `DELIVERED` order containing the product — not a permission. | KC-184 |
| 3 | Reviews are created `PENDING` and are invisible **to the public** until moderated to `APPROVED`. Narrowed 2026-08-11 (`FEAT-PENDING-REVIEW-VISIBILITY`): the review's own author may always see it, in any moderation state, via `GET /reviews/mine`. Every other visitor's view is unchanged. | KC-184; narrowed by owner decision, 2026-08-11 |
| 4 | Only `APPROVED` reviews are displayed **or counted in rating aggregates**. | KC-184 |
| 5 | One review per user per product, enforced by a unique constraint on `(productId, userId)`. | schema |
| 6 | `rating` is 1–5, enforced by the `rating_range` CHECK constraint. | KC-134 |
| 7 | Reviews **commands** Catalog to recompute rating aggregates and **never writes `products`** or emits `product.upserted`. | `ADR-0008`, Law 5 |
| 8 | A review by a **soft-deleted user displays anonymously** — "Anonymous" or "Verified buyer" — never the user's name. The review content remains, and the `verifiedPurchase` badge is retained. | Owner decision, 2026-08-07 |

**Invariant 1 answers `PRODUCT.md`'s own Open Question 3**, which asked whether
reviews should require purchase verification at launch. The implemented answer
is no — moderate instead, and badge the ones that are verified.

**Invariant 7 was the in-flight `ADR-0008` correction, and is now built**
(`FEAT-RATING-OWNERSHIP`, 2026-08-08). Reviews wrote `Product.avgRating`
directly and emitted Catalog's event (KC-152) — the only boundary violation
Discovery found, and the structural cause of the silent-desync risk (KC-142).
`adminModerate` now commands `ProductsService.withRatingRecompute`, which runs
the moderation write and the recompute in one transaction and emits after it
commits. A structural test (`common/architecture.spec.ts`) fails the build if
any module outside Catalog writes the product row or emits its events.

**Invariant 8 separates the feedback from the person.** The review is product
information and stays useful to other customers; the identity is the part
someone deleting their account reasonably expects to stop appearing. The
`verifiedPurchase` badge survives because it is a fact about the **purchase**,
not about the person — it says the item was genuinely bought, which is exactly
what a reader needs and reveals nothing about who bought it.

**This is a display rule, not deletion.** Users are soft-deleted (`DOM-IDENTITY`
inv. 3), so the name still exists in the database and the review's `userId`
relation is intact. Genuine erasure would be a separate PII-scrubbing path and
is not specified here.

**The rejected alternative** — a policy that public reviews keep the author's
name permanently — is defensible only if disclosed prominently at signup, and
it suppresses review submissions from anyone who reads it.

## 4. API Surface

**Customer** — `POST /reviews`, `GET /products/:productId/reviews` (public,
`APPROVED` only, unchanged by the entry below), `GET /reviews/mine?productId=`
(authenticated; the caller's own review for that product in any moderation
state — `FEAT-PENDING-REVIEW-VISIBILITY`, 2026-08-11)
**Admin** — `GET /admin/reviews/pending`, `PATCH /admin/reviews/:id/moderate`

## 5. Events

**Publishes** — none. (It emitted `product.upserted` until `ADR-0008` landed;
Invariant 7 forbids it and a structural test now enforces that.)
**Consumes** — none.

## 6. Data Ownership

`reviews` — unique `(product_id, user_id)`; indexed
`(productId, moderationStatus, createdAt DESC)` for the PDP read path;
`rating_range` CHECK.

**Reads, does not own:** `order_items`, to compute `verifiedPurchase`.

## 7. Dependencies

**Allowed** — Catalog (command, to recompute aggregates); Ordering (read, for
verified-purchase); audit log.

**Forbidden** — writing `products` (Invariant 7); emitting Catalog's events;
reading Payments, Shopping or Returns.

## 8. Edge Cases & Validations

1. **Review submitted for a product the user never bought.** Permitted
   (Invariant 1), badged unverified.
2. **User buys the product after reviewing it.** `verifiedPurchase` was
   computed at write time and does not retroactively update. Whether it should
   is **unspecified** — recorded as a gap.
3. **Second review by the same user.** Rejected by the unique constraint with a
   clean 409.
4. **Moderation approves a review.** Catalog must recompute, or the aggregate
   silently excludes it (Invariant 4).
5. **Moderation rejects a previously approved review.** The aggregate must
   recompute downward — the case most likely to be missed.
6. **Review on a soft-deleted product.** Remains; the product is invisible to
   customers anyway.
7. **A soft-deleted user's review.** Remains visible, displayed anonymously
   with the verified badge retained (Invariant 8).
8. **A user deletes their account after reviewing.** Existing reviews switch to
   anonymous display immediately — the rule is evaluated on read, so no
   backfill or rewrite is needed.

## Constitution compliance

Law 1 — Invariant 7 is marked as not-yet-true. Law 2 — sourced. Law 4 —
Invariants 5 and 6 are database-enforced. Law 5 — Invariant 7 is the correction
that brings this domain into compliance.

## Open items

- ~~**`ADR-0008` refactor is unbuilt** — the system's only boundary violation~~
  — **built 2026-08-08** (`FEAT-RATING-OWNERSHIP`).
- **Edge case 2** — whether `verifiedPurchase` should update retroactively.
- **Invariant 8 is unbuilt** — the read path currently has no
  deleted-user branch.
- ~~**The admin moderation UI does not exist** — `GET /admin/reviews/pending`
  and `PATCH /admin/reviews/:id/moderate` were real, working endpoints that
  nothing in the admin frontend called, so every review submitted since
  launch stayed permanently `PENDING`~~ — **built 2026-08-11**
  (`FEAT-ADMIN-REVIEW-MODERATION`): `/admin/reviews`, linked from the
  dashboard's pending-reviews stat card. `adminListPending` now `include`s
  `product`/`user` so the queue is readable by name and email, not raw FKs.
