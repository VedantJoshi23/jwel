---
id: DOM-CATALOG
title: 'Jwel / ELYSIAN — Domain: Catalog'
version: 1.1.0
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
| 2 | `DRAFT → PUBLISHED` requires a **completeness check**. Hard blocks: non-zero price on every variant, a non-placeholder name, a non-placeholder description, a valid size where the category is sized, and at least one variant. At least one image is a **warning**, not a block. | KC-192, `FEAT-PUBLISH-COMPLETENESS` |
| 3 | Products, categories and coupons **soft-delete**; historical orders keep referential integrity. | KC-132 |
| 4 | `Product.slug` is unique and stable. Changing it requires a redirect from the old path. | `STD-SEO` r6 |
| 5 | Catalog **owns the write** to `avgRating`/`ratingCount`. Reviews commands a recompute; Catalog performs it and emits `product.upserted`. | `ADR-0008`, KC-158 |
| 6 | The rating recompute is **idempotent and bulk-runnable** — derived from the review set, never incremented. | KC-159 |
| 7 | Prices are integer minor units on `ProductVariant.basePriceMinorUnits`. | KC-131 |
| 8 | Publication and deletion emit `product.upserted` / `product.deleted` so Search stays consistent. | KC-150 |
| 9 | A category declares a **sizing scheme** or declares it has none. `NULL` means "inherit from parent"; `SizeScheme.NONE` means "no size at all" and stops inheritance. | `FEAT-SIZE-TAXONOMY` |
| 10 | A variant in a sized category **must** carry a size drawn from the seeded vocabulary for that scheme; a variant in an unsized category **must not** carry one. | `FEAT-SIZE-TAXONOMY` |
| 11 | Size values are **seeded reference data**, never user-entered. There is no runtime write path for the vocabulary. | `FEAT-SIZE-TAXONOMY` |

**Invariants 9–11 are implemented** (`FEAT-SIZE-TAXONOMY`). Invariant 10 spans
`Category` → `Product` → `ProductVariant`, so it cannot be a CHECK constraint;
it is enforced in `products/size-validation.ts` and the limitation is
documented at the `SizeOption` model, per `STD-DATABASE` r6.

The `NONE`-versus-`NULL` distinction in Invariant 9 is not decoration. A single
nullable column cannot express both "inherit" and "explicitly none", and the
first implementation collapsed them — which made an Adjustable ring
sub-category inherit `RING_INDIA` from Rings. Caught by running resolution
against real category rows, not by review.

**Invariant 2 is implemented** (`FEAT-PUBLISH-COMPLETENESS`). It was the
highest-value unbuilt rule in this domain: publishing validated nothing
(KC-185), which is how a ₹0 placeholder named "Untitled Draft 1041" became
shoppable, and 1,045 more await client data entry.

**The rule that decides block from warning** is worth carrying, because it
classifies future fields rather than just the current five: a field is a **hard
block when its absence fails silently** — the product looks fine but cannot be
found — and a **warning when it fails visibly**. Price, name, description and
size all feed search, filtering or sorting; description especially, since
`search_vector` is generated from `name || description`. A missing image is
obvious to anyone looking at the storefront, so blocking on it would stop a
client publishing a correct product because one photo is still being edited.

Two deliberate limits: the gate runs on the **transition** into `PUBLISHED`,
not on every edit of a published product (which would refuse changes to
products published before it existed), and there is **no override** — an
override is how a gate stops meaning anything.

**Invariant 5 was the in-flight `ADR-0008` correction, and is now built**
(`FEAT-RATING-OWNERSHIP`, 2026-08-08). Catalog owns the column, the value, the
write and the `product.upserted` emission. Reviews commands
`withRatingRecompute`, which runs the caller's write and the recompute in one
transaction and emits after commit.

**With ownership came recoverability.** `POST /admin/products/ratings/reconcile`
rederives every aggregate from the approved review set, with a `dryRun` that
reports drift without writing. Ownership makes the value correct by
construction; reconciliation repairs it when construction is bypassed — the
demo seed, CSV bulk import and manual SQL correction are all live bypasses.

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
- ~~**Invariant 5 is unbuilt** — `ADR-0008`'s refactor~~ — **built
  2026-08-08** (`FEAT-RATING-OWNERSHIP`), with bulk reconciliation.
- `searchVector`'s raw-SQL index is invisible to Prisma drift detection
  (KC-144).
