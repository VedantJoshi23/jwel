---
id: DOM-CATALOG
title: 'Jwel / ELYSIAN — Domain: Catalog'
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
  - ADR-0008
  - ADR-0016
tags:
  - domain
  - catalog
risk: High
complexity: High
---

# DOM-CATALOG

**Depth tier: Full** — owns the product truth every other context reads.

## 1. Overview

Catalog owns what is for sale: products, their variants, media, categories and
collections, and whether each is visible to customers. It is the most widely
read context in the system and writes to nothing outside itself.

## 2. Ownership

**Owns** — `Product`, `ProductVariant`, `ProductMedia`, `Category`,
`Collection`, `CollectionProduct`, publication state, and — per `ADR-0008` —
the **rating aggregates** `avgRating` and `ratingCount`.

**Explicitly does NOT own** — review content (Reviews); stock (Inventory); the
search index (Search); prices *charged* (an order's price is its own snapshot);
storefront copy, which lives in `brand.ts`.

## 3. Invariants

| # | Invariant | Source |
| --- | --- | --- |
| 1 | A product is created `DRAFT`. Only `PUBLISHED`, non-deleted products are visible to customers. | KC-185 |
| 2 | `DRAFT → PUBLISHED` requires a **completeness check**: non-zero price on every variant, a name that is not an auto-generated placeholder, a real description, at least one variant and at least one image. | KC-192 |
| 3 | Products, categories and coupons **soft-delete**; historical orders keep referential integrity. | KC-132 |
| 4 | `Product.slug` is unique and stable. Changing it requires a redirect from the old path. | `STD-SEO` r6 |
| 5 | Catalog **owns the write** to `avgRating`/`ratingCount`. Reviews commands a recompute; Catalog performs it and emits `product.upserted`. | `ADR-0008`, KC-158 |
| 6 | The rating recompute is **idempotent and bulk-runnable** — derived from the review set, never incremented. | KC-159 |
| 7 | Prices are integer minor units on `ProductVariant.basePriceMinorUnits`. | KC-131 |
| 8 | Publication and deletion emit `product.upserted` / `product.deleted` so Search stays consistent. | KC-150 |

**Invariant 2 does not exist yet.** Publishing currently validates nothing
(KC-185) — which is how a ₹0 placeholder named "Untitled Draft 1041" became
shoppable. With 1,045 placeholders awaiting client data entry and the client
operating the tool, this is the highest-value unbuilt rule in this domain.

**Invariant 5 is the in-flight `ADR-0008` correction.** Reviews currently writes
`Product.avgRating` directly (KC-152). Until the refactor lands, the system does
not match this spec — a known, recorded deviation.

## 4. API Surface

**Customer** — `GET /products`, `GET /products/:slug`, `GET /collections`,
`GET /collections/:slug`, `POST /products/:productId/views`
**Admin** — product CRUD, media upload and reorder, CSV bulk import, category
and collection CRUD.

## 5. Events

**Publishes** — `product.upserted`, `product.deleted`; both consumed by Search.
**Consumes** — none.

## 6. Data Ownership

`products` (unique slug; GIN trigram on name; `searchVector` tsvector with a
raw-SQL GIN index — invisible to Prisma, KC-144), `product_variants` (unique
sku), `product_media`, `categories`, `collections`, `collection_products`.

## 7. Dependencies

**Allowed** — Storage (shared infrastructure, for media); audit log.

**Forbidden** — writing `reviews`, `inventory_items`, `orders`, `carts` or any
other context's tables; reading Payments or Returns; emitting another context's
events.

## 8. Edge Cases & Validations

1. **Publishing an incomplete product.** Rejected once Invariant 2 exists;
   currently permitted (KC-185).
2. **Bulk CSV import creating hundreds of drafts.** Permitted — drafts are
   invisible to customers. The risk is at publish, not import.
3. **Deleting a product referenced by historical orders.** Soft delete only
   (Invariant 3); the order's snapshot is unaffected regardless.
4. **Slug collision on rename.** Unique constraint rejects it.
5. **Rating recompute racing a review write.** The recompute is synchronous and
   in the same transaction as the review (`ADR-0008`), so it cannot observe a
   partial state.
6. **Rating aggregates desynced by a path that bypasses the service** — a seed
   script, a bulk import, manual SQL. Invariant 6's bulk recompute is the
   recovery, and the reason it must exist (KC-142).
7. **Archived variant still in someone's cart.** Catalog does not police carts;
   Ordering rejects the checkout.

## Constitution compliance

Law 1 — Invariants 2 and 5 are marked as not-yet-true rather than described as
current. Law 2 — sourced. Law 4 — Invariant 4 is a database constraint; 2 is
application-layer because it spans several tables. Law 5 — Invariant 5 makes
Catalog the sole writer of its own aggregate.

## Open items

- **Invariant 2 is unbuilt** and gates safe hand-off of the catalog to the
  client.
- **Invariant 5 is unbuilt** — `ADR-0008`'s refactor.
- `searchVector`'s raw-SQL index is invisible to Prisma drift detection
  (KC-144).
