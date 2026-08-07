---
id: FEAT-PUBLISH-COMPLETENESS
title: 'Jwel / ELYSIAN — Feature: Publish-Time Completeness Checks'
version: 0.1.0
status: Review
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M6
category: Features
priority: Critical
depends_on:
  - DOM-CATALOG
  - CONSTITUTION
  - FEAT-SIZE-TAXONOMY
required_by: []
related_documents:
  - DISC-008
  - STD-API
  - STD-DATABASE
related_domains:
  - DOM-CATALOG
related_decisions:
  - ADR-0015
tags:
  - feature
  - catalog
  - publishing
risk: High
complexity: Medium
---

# FEAT-PUBLISH-COMPLETENESS

## 1. Overview

Publishing a product validates **nothing**. `status` is a plain optional field
on `UpdateProductDto`, and `adminUpdate` passes it straight through to
`tx.product.update` (KC-185). There is no check on price, name, description,
media or variants.

That is how a ₹0 placeholder named *"Untitled Draft 1041"*, whose description
read *"Pending — placeholder draft created from an uploaded image. Edit before
publishing"*, became shoppable on the storefront and took orders (KC-015,
KC-052).

Today the only publisher is the owner and that product was published
deliberately, to exercise the payment flow. **That changes now.** The catalogue
holds 1,045 zero-priced `Untitled Draft NNNN` rows awaiting client data entry
(KC-030, KC-049), and the client — learning the tool — is the party who will be
publishing them.

This feature makes `DRAFT → PUBLISHED` a gate rather than a field assignment.

## 2. Owning Domain

**Owning domain: `DOM-CATALOG`.** Publication state is Catalog's, and every
field checked belongs to `Product` or `ProductVariant`.

**Dependencies** — checked against the initiating domain's Allowed list per
`OV-007`:

| Domain | Call | Allowed by |
| --- | --- | --- |
| Storage | Media presence is read from `ProductMedia` rows, not from the object store | No new call — `DOM-CATALOG` §7 already allows Storage |

No new cross-domain dependency. The checks read only tables Catalog owns.

## 3. Acceptance Criteria

### The rule that decides block from warning

A field is a **hard block** when its absence fails **silently** — the product
appears fine but cannot be found. A field is a **warning** when its absence
fails **visibly** — anyone looking at the storefront can see it.

*Owner decision, 2026-08-07.* This is the principle, not the list; a future
field is classified by applying it rather than by precedent.

1. **Hard blocks** — publication is refused:

   | Check | Why it is a block |
   | --- | --- |
   | Every variant has `basePriceMinorUnits > 0` | Price drives sort and the price-range filter. A ₹0 product sorts to the top of "price: low to high" and matches every price filter |
   | Name is present and is not an auto-generated placeholder | Name feeds `search_vector` and is the primary match target |
   | Description is present and is not placeholder text | `search_vector` is **generated from `name \|\| description`** — a product with no description is materially less findable, and nothing about the storefront reveals it |
   | Every variant in a sized category has a valid size | Size drives the category filter (`FEAT-SIZE-TAXONOMY`) |
   | At least one variant | A product with no variant has no price, no size and nothing to add to a cart |

2. **Warnings** — publication proceeds, the response reports them:

   | Check | Why it is only a warning |
   | --- | --- |
   | At least one image | A product with no image is obviously wrong to anyone who looks at it. It fails loudly, and blocking would stop a client publishing a correct product because one photo is still being edited |

3. Warnings are **returned to the caller**, not merely logged. A warning nobody
   sees is not a warning.
4. The checks run on **any transition into `PUBLISHED`**, not only from `DRAFT`
   — including `ARCHIVED → PUBLISHED`.
5. Editing an **already-published** product does not re-run the gate. See §7.2.
6. Bulk import inherits the checks, because it publishes nothing — every import
   creates `DRAFT` (KC-185). No extra work; recorded so the interaction is not
   assumed.
7. A refusal names **every** failure, not the first. A client fixing five
   problems one round trip at a time will lose patience with the tool.

## 4. API Surface

Consistent with `DOM-CATALOG` §4. No new endpoint.

**Changed** — `PATCH /admin/products/:id`

- When `status` transitions to `PUBLISHED` and a hard block fails: `400`, with
  the standard error envelope (`STD-API` r4) listing every failure.
- When only warnings apply: `200`, and the product response carries a
  `publishWarnings: string[]` field.

`publishWarnings` is present only on a response that just published something.
It is **not** persisted — recomputing it is cheap, and storing it would create
a second source of truth for something the product rows already determine
(`STD-DATABASE` r9).

## 5. Events

**Publishes** — `product.upserted`, unchanged. Already emitted by
`adminUpdate`; a refused publish must **not** emit it, since nothing changed.

**Consumes** — none.

## 6. Data Changes

**None.** Every field checked already exists. This feature adds a rule, not a
column — deliberately: a `publishable` boolean would be a cached derivation of
data the rows already carry, and would go stale the moment a price changed.

## 7. Edge Cases & Validations

1. **Placeholder detection.** "Not a placeholder" cannot mean "not empty" —
   the 1,045 drafts have both a name (`Untitled Draft 1041`) and a description
   (`Pending — placeholder draft created from an uploaded image…`). The check
   must recognise the generated patterns specifically, and be documented where
   the generator lives so the two stay in step.
2. **Already-published products.** The gate runs on the *transition*. Editing a
   published product's price to `0` is not blocked by this feature — that is a
   separate rule, and blocking it here would mean re-validating on every edit
   and refusing changes to products that were published before the gate
   existed. **Recorded as a gap**, not solved.
3. **Un-publishing and re-publishing.** `PUBLISHED → ARCHIVED → PUBLISHED`
   re-runs the gate (criterion 4). Correct: the product may have been archived
   *because* it was wrong.
4. **A product that cannot be fixed.** If a variant genuinely has no price
   because it is not for sale, it should not be published. There is no override,
   and none should be added — an override is how the gate stops meaning
   anything.
5. **Warnings on a product with no images at all.** Publication succeeds with a
   warning. The storefront must not break on a product with zero media —
   verified separately, since this feature makes that state reachable
   deliberately rather than accidentally.
6. **Bulk publish.** No bulk publish endpoint exists. If one is added it must
   apply the same gate per product and report per product, or it becomes the
   hole through which 1,045 placeholders arrive.
7. **Whitespace-only description.** Treated as absent. `"   "` passes a naive
   presence check and contributes nothing to `search_vector`.

## 8. Non-Functional Considerations

| Standard | Bearing |
| --- | --- |
| **`STD-API`** | Refusals use the standard error envelope (r4). Warnings ride on the success response rather than inventing a second channel. |
| **`STD-DATABASE`** | No stored derivation (r9). The gate spans `Product` → `ProductVariant` → `ProductMedia`, so it cannot be a CHECK constraint — application-layer, with the limitation documented per r6. |
| **`STD-TESTING`** | Every §7 edge case needs a test (r6). Placeholder detection especially: a regex that stops matching the generator's output fails open, publishing exactly what this feature exists to stop. |
| **`STD-SEO`** | Directly served. A published product with no description is a thin page competing for organic traffic — the acquisition channel the business depends on. |
| **`STD-CODE`** | Checks live beside the size validation they sit next to, as pure functions over a loaded product. |

**Law 1 check.** This feature is Law 1 applied to the catalogue: a published
product is a claim that it is for sale. A ₹0 placeholder with no description is
a surface asserting a capability the business does not have.

## 9. Definition of Done

Verified end to end against a scratch Postgres with three representative
products — a generated placeholder, a complete product, and a complete product
with no image:

| Case | Result |
| --- | --- |
| `Untitled Draft 1041`, ₹0, no size | **400**, all four blockers in one message |
| Complete product | `PUBLISHED`, no warnings |
| Complete but no image | `PUBLISHED` **with** a warning |
| Refused product's stored status | still `DRAFT` — nothing written |


- [x] Hard-block checks implemented for price, name, description, size and
      variant presence.
- [x] Image check implemented as a warning, returned on the response.
- [x] Placeholder detection matches the generator's actual output, with a test
      pinning them together.
- [x] Gate runs on any transition into `PUBLISHED`, including from `ARCHIVED`.
- [x] A refusal lists every failure, not the first.
- [x] A refused publish does not emit `product.upserted`.
- [x] Every §7 edge case covered by a test.
- [x] `DOM-CATALOG` Invariant 2 updated — it currently describes this as
      unbuilt.
- [x] Admin UI surfaces the refusal list and the warnings usefully, rather than
      a bare 400.
