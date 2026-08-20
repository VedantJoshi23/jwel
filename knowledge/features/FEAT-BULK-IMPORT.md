---
id: FEAT-BULK-IMPORT
title: 'Jwel / ELYSIAN — Feature: CSV Bulk Product Import'
version: 1.0.0
status: Review
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-20
updated: 2026-08-20
milestone: M6
category: Features
priority: Medium
depends_on:
  - DOM-CATALOG
required_by: []
related_documents:
  - FEAT-SIZE-TAXONOMY
  - FEAT-PUBLISH-COMPLETENESS
related_domains:
  - DOM-CATALOG
related_decisions: []
tags:
  - feature
  - catalog
  - admin
risk: Low
complexity: Low
---

# FEAT-BULK-IMPORT

## 1. Overview

CSV bulk product import (`BulkImportService`, built pre-Oriveda) has never had
a specification of its own — its column schema existed only as fragments
inside other features' domain files, a flat unlabelled list in a Swagger
summary, and the service's own code. An admin had no way to learn the
expected columns short of already knowing them or reading an error message.
This document is that specification, written **against the already-built
service** (Constitution Law 1 — describing what exists, not proposing new
backend behavior), plus two genuinely new deliverables that close the
documentation gap: a downloadable template CSV and inline column help in the
admin upload UI.

## 2. Owning Domain

**Owning domain: `DOM-CATALOG`.** Bulk import creates `Product` and
`ProductVariant` rows through the same `ProductsService.adminCreate` path
admin CRUD already uses — no new domain, no new API surface beyond the
existing `POST /admin/products/bulk-import`.

## 3. Acceptance Criteria

1. An admin can download a template CSV with the correct header row (and one
   example data row) from the bulk-import control in the admin product list.
2. The admin upload UI shows, without needing to trigger an upload first,
   which columns are required, which are optional, and what happens when an
   optional column is blank or a required one is missing.
3. Existing import behavior is unchanged — this feature documents and
   surfaces what already works, it does not alter validation, error
   messages, or the one-row-per-product-and-variant scope cut.

## 4. API Surface

**No change.** `POST /admin/products/bulk-import` (multipart, field `file`)
is the only endpoint; this feature adds a static template file the admin
frontend links to, not a new route.

## 5. The schema, documented

*(Read from `bulk-import.service.ts`, not re-derived — this section is the
authoritative human-facing copy of what that file already enforces.)*

**Required columns** — a blank value rejects the row, naming the column:

| Column | Rejected when |
| --- | --- |
| `name` | blank |
| `slug` | blank |
| `category_slug` | blank, or no `Category` with that slug exists |
| `description` | blank |
| `sku` | blank (a duplicate SKU is **not** caught here — it surfaces as whatever error the database's unique constraint produces via `adminCreate`, see §7 Edge Case 5) |
| `metal` | blank, or not a valid `MetalType` |
| `weight_grams` | blank, or not a finite non-negative number |
| `base_price_minor_units` | blank, or not a non-negative integer |

**Optional columns** — blank is fine, no default beyond "unset":

| Column | Blank behavior | If present |
| --- | --- | --- |
| `certification_type` | unset | must be a valid `CertificationType`, or the row is rejected |
| `certification_doc_ref` | unset | no format check |
| `purity` | unset | no format check at this layer |
| `size` | unset | validated against the seeded size taxonomy for the row's category (`FEAT-SIZE-TAXONOMY` criterion 9) — invalid size rejects the row and lists the valid options for that category |

**Mechanics worth knowing**, restated for the admin reader rather than the
implementer:

- **One row = one product with exactly one variant.** There is no way to
  import a product with multiple sizes/metals in one CSV; each combination
  needs its own row with its own unique `sku` (and, if they're meant to be
  the same product, the same `slug` — untested/unsupported today, see §7
  Edge Case 6).
- **A bad row never stops the file.** Every row is attempted independently;
  the response lists which rows succeeded, which failed, and why, by
  spreadsheet row number (header row counts as row 1, so the first data row
  is row 2).
- **Two things fail the whole upload**, not just one row: an empty CSV, and
  a CSV missing one of the 8 required column headers entirely.
- Every imported product is created as `DRAFT` (`ProductsService.adminCreate`'s
  ordinary behavior) — nothing bulk-imported is customer-visible until an
  admin explicitly publishes it, which is itself gated by
  `FEAT-PUBLISH-COMPLETENESS`.

## 6. Events

**Publishes** — `product.upserted` per successfully created row, via the
same `adminCreate` path ordinary product creation already uses. No new event.
**Consumes** — none.

## 7. Edge Cases & Validations

1. **Blank required column.** Row rejected, error names the column.
2. **Unknown `category_slug`.** Row rejected: `Category with slug "X" not
   found`.
3. **Invalid `metal`/`certification_type` enum value.** Row rejected, error
   names the bad value.
4. **Non-numeric `weight_grams` or non-integer `base_price_minor_units`.**
   Row rejected.
5. **Duplicate `sku` within the file, or against an existing product.** Not
   specially handled — reaches the database's unique constraint through
   `adminCreate` and surfaces whatever error that produces. **Not covered by
   `bulk-import.service.spec.ts`** — a real test-coverage gap, named here
   rather than silently left, per `STD-TESTING` rule 3 (an exclusion or gap
   should be visible, not assumed closed).
6. **The same product split across multiple rows** (e.g. two sizes of one
   design) sharing a `slug` but different `sku`s. Untested and unsupported —
   each row creates an independent `Product`, so two rows with the same
   `slug` will collide on `Product.slug`'s uniqueness (`DOM-CATALOG`
   Invariant 4) rather than merge into variants of one product. An admin
   wanting multiple variants per product still needs to create the product
   once and add variants through the ordinary admin UI.
7. **Invalid `size` for the row's category.** Row rejected; `adminCreate`'s
   error lists the valid sizes for that specific category, not a generic
   message.

## 8. Non-Functional Considerations

| Standard | Bearing |
| --- | --- |
| **`STD-API`** | No new route; the existing endpoint already goes through the global `ValidationPipe` and `AllExceptionsFilter` (rules 3–4). |
| **`STD-ACCESSIBILITY`** | The new inline column-help content and template-download link are plain text/links, reachable and readable the same as the rest of the admin page; no new interactive control beyond a standard link/button. |
| **`STD-TESTING`** | §7 Edge Case 5 (duplicate SKU) is named as an existing gap rather than fixed here — fixing it is a behavior change to `bulk-import.service.ts`, out of scope for a documentation feature; tracked as an open item in §11. |

## 9. Definition of Done

- [x] This specification written against the existing, already-built
      service.
- [x] Template CSV (header row + one example row, covering every column)
      added under `apps/web/public/templates/` and linked from the
      bulk-import control.
- [x] Inline column help (the §5 tables, in plain admin-facing language)
      added to the admin products page, collapsed behind a "CSV format?"
      toggle next to the bulk-import button.
- [x] `DOM-CATALOG` gains a cross-reference to this spec (§4 API Surface),
      so the fragment previously duplicated across `FEAT-SIZE-TAXONOMY` and
      `FEAT-PUBLISH-COMPLETENESS` has one canonical home. The two existing
      fragments in those documents are left as-is (Law 2 — not deleted),
      since they document those features' own concerns (size validation,
      publish gating) using bulk import as an example, not a schema
      reference that would now be stale.
- [x] Swagger's `@ApiOperation` summary on `POST /admin/products/bulk-import`
      now distinguishes required from optional columns and points at this
      document, rather than a flat unlabelled list.

## 10. What this does not do

- Does not add duplicate-SKU detection at the bulk-import layer (§7 Edge
  Case 5) — a real gap, not silently closed by writing this document.
- Does not add multi-variant-per-product import (§7 Edge Case 6).
- Does not change any validation behavior, error message, or the CSV parser
  itself — this is a documentation and admin-UX feature only.
